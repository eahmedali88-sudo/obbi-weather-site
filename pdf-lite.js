/*
 * Minimal, dependency-free PDF text extractor — scoped exactly to what the
 * three Bahrain government bulletin PDFs need: single or multi-page,
 * FlateDecode streams, simple (non-CID) TrueType/Type1 fonts, either a
 * ToUnicode CMap or WinAnsiEncoding. No Worker, no WASM, ~10KB instead of
 * pdf.js's ~1.7MB — built after pdf.js's Worker silently hung on some
 * mobile browsers (Edge on Android in particular) instead of failing
 * cleanly, leaving PDF-based cards permanently blank with no visible error.
 *
 * The whole file is decoded once as Latin-1 (a lossless 1:1 byte<->char
 * mapping) so every byte offset in the original PDF corresponds exactly to
 * one JS string index — this lets normal string/regex operations stand in
 * for the byte-level parsing a real PDF library would do in binary.
 */

async function inflate(bytes) {
  const ds = new DecompressionStream("deflate");
  const stream = new Blob([bytes]).stream().pipeThrough(ds);
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

function strToBytes(s) {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

// A true 1:1 byte<->char mapping. TextDecoder('iso-8859-1') is NOT this —
// per the WHATWG Encoding Standard, the "iso-8859-1" label is aliased to
// windows-1252, which remaps bytes 0x80-0x9F to smart quotes/dashes/etc.
// instead of passing them through, silently corrupting binary data
// (compressed stream bytes in our case) on any round trip.
function bytesToBinaryString(bytes) {
  const CHUNK = 8192;
  let result = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    result += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return result;
}

function findObjects(data) {
  const objects = new Map();
  const re = /(\d+)[ \t\r\n]+(\d+)[ \t\r\n]+obj\b/g;
  let m;
  while ((m = re.exec(data)) !== null) {
    const num = parseInt(m[1], 10);
    const start = m.index + m[0].length;
    const endIdx = data.indexOf("endobj", start);
    if (endIdx === -1) continue;
    objects.set(num, data.slice(start, endIdx));
  }
  return objects;
}

function parseDict(body) {
  const startIdx = body.indexOf("<<");
  if (startIdx === -1) return { dict: {}, end: 0 };
  let i = startIdx + 2;
  let depth = 1;
  while (depth > 0 && i < body.length - 1) {
    if (body.slice(i, i + 2) === "<<") {
      depth++;
      i += 2;
    } else if (body.slice(i, i + 2) === ">>") {
      depth--;
      i += 2;
    } else {
      i++;
    }
  }
  const dictBytes = body.slice(startIdx + 2, i - 2);
  const dict = {};
  const keyRe = /\/([A-Za-z0-9]+)[ \t\r\n]*/g;
  let km;
  while ((km = keyRe.exec(dictBytes)) !== null) {
    const key = km[1];
    const rest = dictBytes.slice(keyRe.lastIndex);
    const refM = rest.match(/^(\d+)[ \t\r\n]+(\d+)[ \t\r\n]+R/);
    if (refM) {
      dict[key] = { t: "ref", n: parseInt(refM[1], 10) };
      continue;
    }
    const nameM = rest.match(/^\/([A-Za-z0-9+_.\-]+)/);
    if (nameM) {
      dict[key] = { t: "name", v: nameM[1] };
      continue;
    }
    const numM = rest.match(/^[-+]?\d+\.?\d*/);
    if (numM && numM[0]) {
      dict[key] = { t: "num", v: parseFloat(numM[0]) };
      continue;
    }
    const arrM = rest.match(/^\[([^\]]*)\]/);
    if (arrM) {
      dict[key] = { t: "arr", v: arrM[1] };
      continue;
    }
  }
  return { dict, end: i };
}

async function getStreamBytes(body, objects) {
  const { dict, end } = parseDict(body);
  const sm = body.slice(end).match(/stream\r?\n/);
  if (!sm) return { raw: null, dict };
  const streamStart = end + sm.index + sm[0].length;
  let length;
  const lenEntry = dict["Length"];
  if (lenEntry && lenEntry.t === "num") {
    length = lenEntry.v;
  } else if (lenEntry && lenEntry.t === "ref") {
    const lm = (objects.get(lenEntry.n) || "").match(/[-+]?\d+/);
    length = lm ? parseInt(lm[0], 10) : 0;
  } else {
    const em = body.indexOf("endstream", streamStart);
    length = em === -1 ? 0 : em - streamStart;
  }
  const rawStr = body.slice(streamStart, streamStart + length);
  const filt = dict["Filter"];
  if (filt && filt.t === "name" && filt.v === "FlateDecode") {
    const inflated = await inflate(strToBytes(rawStr));
    return { raw: bytesToBinaryString(inflated), dict };
  }
  return { raw: rawStr, dict };
}

function parseToUnicodeCmap(cmapText) {
  const mapping = new Map();
  const bfcharRe = /beginbfchar([\s\S]*?)endbfchar/g;
  let bm;
  while ((bm = bfcharRe.exec(cmapText)) !== null) {
    const pairRe = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g;
    let pm;
    while ((pm = pairRe.exec(bm[1])) !== null) {
      const src = parseInt(pm[1], 16);
      const dst = pm[2];
      let s = "";
      for (let i = 0; i < dst.length; i += 4) s += String.fromCharCode(parseInt(dst.slice(i, i + 4), 16));
      mapping.set(src, s);
    }
  }
  const bfrangeRe = /beginbfrange([\s\S]*?)endbfrange/g;
  let rm;
  while ((rm = bfrangeRe.exec(cmapText)) !== null) {
    const tripleRe = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g;
    let tm;
    while ((tm = tripleRe.exec(rm[1])) !== null) {
      const lo = parseInt(tm[1], 16);
      const hi = parseInt(tm[2], 16);
      const base = parseInt(tm[3], 16);
      for (let code = lo; code <= hi; code++) mapping.set(code, String.fromCharCode(base + (code - lo)));
    }
  }
  return mapping;
}

const WINANSI_HIGH = {
  0x80: "€", 0x82: "‚", 0x83: "ƒ", 0x84: "„",
  0x85: "…", 0x86: "†", 0x87: "‡", 0x88: "ˆ",
  0x89: "‰", 0x8A: "Š", 0x8B: "‹", 0x8C: "Œ",
  0x8E: "Ž", 0x91: "‘", 0x92: "’", 0x93: "“",
  0x94: "”", 0x95: "•", 0x96: "–", 0x97: "—",
  0x98: "˜", 0x99: "™", 0x9A: "š", 0x9B: "›",
  0x9C: "œ", 0x9E: "ž", 0x9F: "Ÿ",
};

function winansiMap() {
  const m = new Map();
  for (let c = 32; c < 256; c++) m.set(c, WINANSI_HIGH[c] || String.fromCharCode(c));
  return m;
}

function asciiMap() {
  const m = new Map();
  for (let c = 32; c < 128; c++) m.set(c, String.fromCharCode(c));
  return m;
}

async function extractFontMaps(objects) {
  const fontObjs = new Map();
  for (const [num, body] of objects) {
    if (/\/Type[ \t\r\n]*\/Font\b/.test(body)) fontObjs.set(num, body);
  }
  const resolved = new Map();
  for (const [num, body] of fontObjs) {
    const { dict } = parseDict(body);
    const enc = dict["Encoding"];
    const tu = dict["ToUnicode"];
    let cmap;
    if (tu && tu.t === "ref" && objects.has(tu.n)) {
      const { raw } = await getStreamBytes(objects.get(tu.n), objects);
      cmap = raw ? parseToUnicodeCmap(raw) : new Map();
    } else if (enc && enc.t === "name" && enc.v === "WinAnsiEncoding") {
      cmap = winansiMap();
    } else {
      cmap = asciiMap();
    }
    resolved.set(num, cmap);
  }
  return { fontMapsByObj: resolved, fontObjs };
}

function getPageFontNameMap(objects) {
  const result = {};
  const parseFontSubdict = (sub) => {
    const re = /\/([A-Za-z0-9]+)[ \t\r\n]+(\d+)[ \t\r\n]+\d+[ \t\r\n]+R/g;
    let fm;
    while ((fm = re.exec(sub)) !== null) result[fm[1]] = parseInt(fm[2], 10);
  };
  for (const [, body] of objects) {
    let m = body.match(/\/Font[ \t\r\n]*<<([\s\S]*?)>>/);
    if (m) {
      parseFontSubdict(m[1]);
      continue;
    }
    m = body.match(/\/Font[ \t\r\n]+(\d+)[ \t\r\n]+\d+[ \t\r\n]+R/);
    if (m) {
      const refBody = objects.get(parseInt(m[1], 10)) || "";
      const dm = refBody.match(/<<([\s\S]*?)>>/);
      if (dm) parseFontSubdict(dm[1]);
    }
  }
  return result;
}

function decodePdfLiteralString(raw) {
  const out = [];
  let i = 0;
  while (i < raw.length) {
    const c = raw.charCodeAt(i);
    if (c === 0x5c && i + 1 < raw.length) {
      const n = raw.charCodeAt(i + 1);
      const simple = { 0x6e: "\n", 0x72: "\r", 0x74: "\t", 0x62: "\b", 0x66: "\f", 0x28: "(", 0x29: ")", 0x5c: "\\" };
      if (simple[n] !== undefined) {
        out.push(simple[n]);
        i += 2;
      } else if (n >= 0x30 && n <= 0x37) {
        let j = i + 1;
        let digits = "";
        while (j < raw.length && digits.length < 3 && raw.charCodeAt(j) >= 0x30 && raw.charCodeAt(j) <= 0x37) {
          digits += raw[j];
          j++;
        }
        out.push(String.fromCharCode(parseInt(digits, 8) & 0xff));
        i = j;
      } else if (n === 0x0a || n === 0x0d) {
        i += 2;
        if (n === 0x0d && i < raw.length && raw.charCodeAt(i) === 0x0a) i++;
      } else {
        out.push(String.fromCharCode(n));
        i += 2;
      }
    } else {
      out.push(String.fromCharCode(c));
      i++;
    }
  }
  return out.join("");
}

function tokenizeContent(text, fontMaps) {
  const outLines = [];
  let currentLine = [];
  let currentFontMap = new Map();
  let lastY = null;
  let pendingNums = [];
  let i = 0;
  const n = text.length;

  const flushLine = () => {
    if (currentLine.length) {
      outLines.push(currentLine.join(""));
      currentLine = [];
    }
  };

  while (i < n) {
    const ch = text[i];
    if (ch === "(") {
      let depth = 1;
      let j = i + 1;
      while (j < n && depth > 0) {
        if (text[j] === "\\") {
          j += 2;
          continue;
        }
        if (text[j] === "(") depth++;
        else if (text[j] === ")") depth--;
        j++;
      }
      const rawStr = text.slice(i + 1, j - 1);
      const decoded = decodePdfLiteralString(rawStr);
      for (const ch2 of decoded) {
        const code = ch2.charCodeAt(0);
        currentLine.push(currentFontMap.get(code) ?? ch2);
      }
      i = j;
      pendingNums = [];
      continue;
    }
    if (ch === "<" && text[i + 1] !== "<") {
      const j = text.indexOf(">", i + 1);
      if (j === -1) {
        i++;
        continue;
      }
      const hexstr = text.slice(i + 1, j).replace(/\s+/g, "");
      const padded = hexstr.length % 2 ? hexstr + "0" : hexstr;
      for (let k = 0; k < padded.length; k += 2) {
        const code = parseInt(padded.slice(k, k + 2), 16);
        currentLine.push(currentFontMap.get(code) ?? String.fromCharCode(code));
      }
      i = j + 1;
      pendingNums = [];
      continue;
    }
    if (ch === "/") {
      const m = text.slice(i).match(/^\/([A-Za-z0-9]+)/);
      if (m) {
        const name = m[1];
        const restAfter = text.slice(i + m[0].length, i + m[0].length + 20);
        if (/^\s+[-\d.]+\s+Tf\b/.test(restAfter)) {
          currentFontMap = fontMaps[name] || new Map();
        }
        i += m[0].length;
        pendingNums = [];
        continue;
      }
    }
    const isTd = text.slice(i, i + 2) === "Td" && !/[A-Za-z0-9]/.test(text[i + 2] || "");
    const isTD = text.slice(i, i + 2) === "TD" && !/[A-Za-z0-9]/.test(text[i + 2] || "");
    const isTm = text.slice(i, i + 2) === "Tm" && !/[A-Za-z0-9]/.test(text[i + 2] || "");
    if (isTd || isTD || isTm) {
      const ty = pendingNums.length ? pendingNums[pendingNums.length - 1] : null;
      if (ty !== null && lastY !== null && Math.abs(ty - lastY) > 3) {
        flushLine();
      } else if (currentLine.length && currentLine[currentLine.length - 1] !== " " && currentLine[currentLine.length - 1] !== "\t") {
        currentLine.push(" ");
      }
      if (ty !== null) lastY = ty;
      i += 2;
      pendingNums = [];
      continue;
    }
    if (text.slice(i, i + 2) === "cm" && !/[A-Za-z0-9]/.test(text[i + 2] || "")) {
      flushLine();
      lastY = null;
      i += 2;
      pendingNums = [];
      continue;
    }
    if (ch === "'" || ch === '"') {
      flushLine();
      i++;
      pendingNums = [];
      continue;
    }
    if (text.slice(i, i + 2) === "T*" && !/[A-Za-z0-9]/.test(text[i + 2] || "")) {
      flushLine();
      i += 2;
      pendingNums = [];
      continue;
    }
    const numM = text.slice(i).match(/^[-+]?\d*\.?\d+/);
    if (numM) {
      pendingNums.push(parseFloat(numM[0]));
      i += numM[0].length;
      continue;
    }
    if (/[A-Za-z]/.test(ch)) {
      const opM = text.slice(i).match(/^[A-Za-z*]+/);
      i += opM ? opM[0].length : 1;
      pendingNums = [];
      continue;
    }
    i++;
  }
  flushLine();
  return outLines.join("\n");
}

function orderedPageNumbers(objects) {
  let pagesRoot = null;
  for (const [num, body] of objects) {
    if (/\/Type[ \t\r\n]*\/Pages\b/.test(body) && !/\/Parent\b/.test(body)) {
      pagesRoot = num;
      break;
    }
  }
  if (pagesRoot === null) {
    const order = [];
    for (const [num, body] of objects) {
      if (/\/Type[ \t\r\n]*\/Page\b(?!s)/.test(body)) order.push(num);
    }
    return order;
  }
  const order = [];
  const walk = (num) => {
    const body = objects.get(num) || "";
    if (/\/Type[ \t\r\n]*\/Page\b(?!s)/.test(body)) {
      order.push(num);
      return;
    }
    const { dict } = parseDict(body);
    const kids = dict["Kids"];
    if (kids && kids.t === "arr") {
      const re = /(\d+)[ \t\r\n]+\d+[ \t\r\n]+R/g;
      let km;
      while ((km = re.exec(kids.v)) !== null) walk(parseInt(km[1], 10));
    }
  };
  walk(pagesRoot);
  return order;
}

export async function extractPdfText(arrayBuffer) {
  const data = bytesToBinaryString(new Uint8Array(arrayBuffer));
  const objects = findObjects(data);
  const { fontMapsByObj } = await extractFontMaps(objects);
  const nameToObj = getPageFontNameMap(objects);
  const fontMapsByName = {};
  for (const [name, obj] of Object.entries(nameToObj)) {
    fontMapsByName[name] = fontMapsByObj.get(obj) || new Map();
  }

  const pageNums = orderedPageNumbers(objects);
  if (!pageNums.length) throw new Error("no /Page object found in PDF");

  const pageTexts = [];
  for (const pnum of pageNums) {
    const { dict } = parseDict(objects.get(pnum) || "");
    const contents = dict["Contents"];
    const rawTexts = [];
    if (contents && contents.t === "ref") {
      const { raw } = await getStreamBytes(objects.get(contents.n) || "", objects);
      if (raw) rawTexts.push(raw);
    } else if (contents && contents.t === "arr") {
      const re = /(\d+)[ \t\r\n]+\d+[ \t\r\n]+R/g;
      let rm;
      while ((rm = re.exec(contents.v)) !== null) {
        const { raw } = await getStreamBytes(objects.get(parseInt(rm[1], 10)) || "", objects);
        if (raw) rawTexts.push(raw);
      }
    }
    pageTexts.push(tokenizeContent(rawTexts.join("\n"), fontMapsByName));
  }
  let full = pageTexts.join("\n");
  full = full.replace(/[ \t]{2,}/g, " ").replace(/[ \t]+\n/g, "\n");
  return full;
}
