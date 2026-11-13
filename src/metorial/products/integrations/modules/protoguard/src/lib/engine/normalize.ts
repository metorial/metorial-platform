import {
  DECODE_BUDGET_CHARS_PER_WINDOW,
  DECODE_MAX_CANDIDATE_CHARS,
  DECODE_MAX_DEPTH,
  DECODE_MIN_CANDIDATE_CHARS
} from './budget';

let PRINTABLE_RATIO_MIN = 0.85;
let DECODED_MIN_CHARS = 8;

let COMBINING_MARKS = new RegExp('[\\u0300-\\u036f]', 'g');
let REPLACEMENT_CHAR = String.fromCharCode(0xfffd);

let LEET: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  $: 's'
};

let CONFUSABLES: Record<string, string> = {
  '\u2018': "'",
  '\u2019': "'",
  '\u201b': "'",
  '\u02bc': "'",
  '\u2032': "'",
  а: 'a',
  в: 'b',
  е: 'e',
  ё: 'e',
  һ: 'h',
  і: 'i',
  ї: 'i',
  ј: 'j',
  к: 'k',
  м: 'm',
  о: 'o',
  р: 'p',
  с: 'c',
  т: 't',
  у: 'y',
  х: 'x',
  ѕ: 's',
  ԁ: 'd',
  ԛ: 'q',
  ԝ: 'w',
  ɡ: 'g',
  ı: 'i',
  ɩ: 'i',
  α: 'a',
  β: 'b',
  γ: 'y',
  ε: 'e',
  η: 'n',
  ι: 'i',
  κ: 'k',
  ν: 'v',
  ο: 'o',
  ρ: 'p',
  τ: 't',
  υ: 'u',
  χ: 'x',
  ω: 'w',
  ς: 's',
  օ: 'o',
  ս: 'u',
  ո: 'n',
  հ: 'h'
};

let HTML_ENTITIES: Record<string, string> = {
  lt: '<',
  gt: '>',
  amp: '&',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  sol: '/',
  colon: ':',
  lpar: '(',
  rpar: ')',
  lsqb: '[',
  rsqb: ']',
  excl: '!'
};

export let isInvisibleCodePoint = (cp: number) =>
  (cp >= 0x200b && cp <= 0x200f) ||
  (cp >= 0x202a && cp <= 0x202e) ||
  (cp >= 0x2060 && cp <= 0x2064) ||
  (cp >= 0x2066 && cp <= 0x2069) ||
  cp == 0xfeff ||
  cp == 0x00ad ||
  cp == 0x180e ||
  cp == 0x034f ||
  (cp >= 0xfe00 && cp <= 0xfe0f) ||
  (cp >= 0xe0000 && cp <= 0xe007f) ||
  (cp >= 0xe0100 && cp <= 0xe01ef);

let isWhitespaceCodePoint = (cp: number) =>
  cp == 0x20 ||
  (cp >= 0x09 && cp <= 0x0d) ||
  cp == 0xa0 ||
  cp == 0x1680 ||
  (cp >= 0x2000 && cp <= 0x200a) ||
  cp == 0x2028 ||
  cp == 0x2029 ||
  cp == 0x202f ||
  cp == 0x205f ||
  cp == 0x3000;

let foldChar = (char: string) => CONFUSABLES[char] ?? LEET[char] ?? char;

let ASCII_FOLD: string[] = Array.from({ length: 128 }, (_, code) =>
  foldChar(String.fromCharCode(code).toLowerCase())
);

let ASCII_FOLD_CODES = Int32Array.from(ASCII_FOLD, char => char.charCodeAt(0));

export let foldAsciiCharCode = (code: number) => (code < 128 ? ASCII_FOLD_CODES[code]! : code);

let nonAsciiCache = new Map<number, string>();

let foldNonAscii = (cp: number) => {
  let cached = nonAsciiCache.get(cp);
  if (cached !== undefined) return cached;

  let decomposed = String.fromCodePoint(cp)
    .normalize('NFKD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase();

  let folded = '';
  for (let char of decomposed) {
    let code = char.codePointAt(0)!;
    if (isInvisibleCodePoint(code)) continue;
    folded += isWhitespaceCodePoint(code) ? ' ' : foldChar(char);
  }

  nonAsciiCache.set(cp, folded);
  return folded;
};

export interface TextView {
  text: string;
  offsets: Int32Array;
}

export let mapOffset = (view: TextView, index: number) =>
  view.offsets[Math.max(0, Math.min(index, view.text.length))]!;

// The canonical view is what phrase and regex rules see: NFKD without diacritics, confusables
// folded to Latin, invisible characters removed, whitespace collapsed, lowercase and leet folded.
// offsets[i] is the raw index the i-th canonical char came from; offsets[text.length] is raw end.
export let canonicalize = (raw: string): TextView => {
  let parts: string[] = [];
  let offsets = new Int32Array(raw.length + 1);
  let length = 0;
  let lastWasSpace = true;

  // Folded characters can be astral (emoji survive NFKD), so offsets are tracked per UTF-16 unit
  // to stay aligned with the indexes regex and phrase matches report.
  let push = (char: string, rawIndex: number) => {
    for (let unit = 0; unit < char.length; unit++) {
      if (length + 1 >= offsets.length) {
        let grown = new Int32Array(offsets.length * 2);
        grown.set(offsets);
        offsets = grown;
      }

      offsets[length++] = rawIndex;
    }

    parts.push(char);
  };

  for (let i = 0; i < raw.length;) {
    let cp = raw.codePointAt(i)!;
    let width = cp > 0xffff ? 2 : 1;

    if (cp < 128) {
      if (isWhitespaceCodePoint(cp)) {
        if (!lastWasSpace) push(' ', i);
        lastWasSpace = true;
      } else {
        push(ASCII_FOLD[cp]!, i);
        lastWasSpace = false;
      }

      i += width;
      continue;
    }

    if (isInvisibleCodePoint(cp)) {
      i += width;
      continue;
    }

    if (isWhitespaceCodePoint(cp)) {
      if (!lastWasSpace) push(' ', i);
      lastWasSpace = true;
      i += width;
      continue;
    }

    for (let char of foldNonAscii(cp)) {
      if (char == ' ') {
        if (!lastWasSpace) push(' ', i);
        lastWasSpace = true;
        continue;
      }

      push(char, i);
      lastWasSpace = false;
    }

    i += width;
  }

  offsets[length] = raw.length;

  return { text: parts.join(''), offsets: offsets.subarray(0, length + 1) };
};

export type DecodedEncoding = 'base64' | 'hex' | 'url' | 'html' | 'tag' | 'unicode_escape';

export interface DecodedPiece {
  rawStart: number;
  rawEnd: number;
  encoding: DecodedEncoding;
  depth: number;
  text: string;
}

let isPrintableText = (text: string) => {
  if (text.length < DECODED_MIN_CHARS) return false;

  let printable = 0;
  for (let i = 0; i < text.length; i++) {
    let code = text.charCodeAt(i);
    if ((code >= 0x20 && code != 0x7f && code != 0xfffd) || code == 0x0a || code == 0x09) {
      printable++;
    }
  }

  return printable / text.length >= PRINTABLE_RATIO_MIN;
};

let utf8 = new TextDecoder('utf-8', { fatal: false });

export let decodeBase64 = (value: string) => {
  let normalized = value.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  if (normalized.length % 4 == 1) normalized = normalized.slice(0, -1);
  return utf8.decode(Buffer.from(normalized, 'base64'));
};

export let decodeHex = (value: string) => {
  let even = value.length % 2 == 0 ? value : value.slice(0, -1);
  return utf8.decode(Buffer.from(even, 'hex'));
};

export let decodePercent = (value: string) => {
  let bytes: number[] = [];

  for (let i = 0; i < value.length; i++) {
    let char = value[i]!;
    if (char == '%' && /^[0-9a-fA-F]{2}$/.test(value.slice(i + 1, i + 3))) {
      bytes.push(Number.parseInt(value.slice(i + 1, i + 3), 16));
      i += 2;
      continue;
    }

    if (char == '+') {
      bytes.push(0x20);
      continue;
    }

    for (let byte of Buffer.from(char, 'utf8')) bytes.push(byte);
  }

  return utf8.decode(Uint8Array.from(bytes));
};

let safeFromCodePoint = (cp: number) =>
  Number.isFinite(cp) && cp >= 0 && cp <= 0x10ffff && !(cp >= 0xd800 && cp <= 0xdfff)
    ? String.fromCodePoint(cp)
    : REPLACEMENT_CHAR;

export let decodeHtmlEntities = (value: string) =>
  value.replace(/&(#x[0-9a-fA-F]{1,6}|#[0-9]{1,7}|[a-zA-Z]{2,8});/g, (match, body: string) => {
    if (body[0] == '#') {
      let isHex = body[1] == 'x' || body[1] == 'X';
      return safeFromCodePoint(Number.parseInt(body.slice(isHex ? 2 : 1), isHex ? 16 : 10));
    }

    return HTML_ENTITIES[body.toLowerCase()] ?? match;
  });

export let decodeTagCharacters = (value: string) => {
  let output = '';
  for (let char of value) {
    let cp = char.codePointAt(0)!;
    if (cp >= 0xe0020 && cp <= 0xe007e) output += String.fromCharCode(cp - 0xe0000);
  }
  return output;
};

export let decodeUnicodeEscapes = (value: string) =>
  value.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) =>
    safeFromCodePoint(Number.parseInt(hex, 16))
  );

interface DecodeCandidate {
  encoding: DecodedEncoding;
  pattern: RegExp;
  runChar: RegExp;
  minChars: number;
  trigger?: string;
  decode: (value: string) => string;
}

let TAG_HIGH_SURROGATE = String.fromCharCode(0xdb40);
let TAG_LOW_SURROGATE = new RegExp('[\\uDC20-\\uDC7E]');

let CANDIDATES: DecodeCandidate[] = [
  {
    encoding: 'base64',
    pattern: /[A-Za-z0-9+/_-]{24,}={0,2}/g,
    runChar: /[A-Za-z0-9+/_=-]/,
    minChars: DECODE_MIN_CANDIDATE_CHARS,
    decode: decodeBase64
  },
  {
    encoding: 'hex',
    pattern: /(?:[0-9a-fA-F]{2}){12,}/g,
    runChar: /[0-9a-fA-F]/,
    minChars: DECODE_MIN_CANDIDATE_CHARS,
    decode: decodeHex
  },
  {
    encoding: 'url',
    pattern: /(?:%[0-9a-fA-F]{2}[^\s%]{0,64}){3,}/g,
    runChar: /\S/,
    trigger: '%',
    minChars: 9,
    decode: decodePercent
  },
  {
    encoding: 'html',
    pattern: /(?:&(?:#x[0-9a-fA-F]{1,6}|#[0-9]{1,7}|[a-zA-Z]{2,8});[^\s&]{0,64}){2,}/g,
    runChar: /\S/,
    trigger: '&',
    minChars: 8,
    decode: decodeHtmlEntities
  },
  {
    encoding: 'tag',
    pattern: /[\u{E0020}-\u{E007E}]{4,}/gu,
    runChar: TAG_LOW_SURROGATE,
    trigger: TAG_HIGH_SURROGATE,
    minChars: 8,
    decode: decodeTagCharacters
  },
  {
    encoding: 'unicode_escape',
    pattern: /(?:\\u[0-9a-fA-F]{4}){4,}/g,
    runChar: /[\\u0-9a-fA-F]/,
    trigger: '\\u',
    minChars: 24,
    decode: decodeUnicodeEscapes
  }
];

let toSticky = (pattern: RegExp) =>
  new RegExp(pattern.source, pattern.flags.replace('g', '') + 'y');

let STICKY_PATTERNS = new Map(
  CANDIDATES.map(candidate => [candidate, toSticky(candidate.pattern)])
);

export interface DecodeRange {
  start: number;
  end: number;
  ownedEnd: number;
}

// Runs are owned by the window they start in. A run that reaches the window end is re-read from
// the segment (bounded by the max candidate size), and a run that started in an earlier window is
// skipped here, so a long encoded run is decoded exactly once instead of once per window.
let findTopLevelRuns = (text: string, range: DecodeRange, candidate: DecodeCandidate) => {
  let runs: { start: number; value: string }[] = [];
  let slice = text.slice(range.start, range.end);
  if (candidate.trigger && !slice.includes(candidate.trigger)) return runs;

  let pattern = candidate.pattern;
  pattern.lastIndex = 0;

  for (let match = pattern.exec(slice); match; match = pattern.exec(slice)) {
    if (!match[0].length) {
      pattern.lastIndex++;
      continue;
    }

    let start = range.start + match.index;
    if (start >= range.ownedEnd) break;

    let isContinuation =
      start == range.start && start > 0 && candidate.runChar.test(text[start - 1]!);
    if (isContinuation) continue;

    let value = match[0];
    let touchesEnd = match.index + value.length == slice.length && range.end < text.length;

    if (touchesEnd) {
      let sticky = STICKY_PATTERNS.get(candidate)!;
      let extended = text.slice(start, start + DECODE_MAX_CANDIDATE_CHARS + 1);
      sticky.lastIndex = 0;
      value = sticky.exec(extended)?.[0] ?? value;
    }

    runs.push({ start, value });
  }

  return runs;
};

let findNestedRuns = (text: string, candidate: DecodeCandidate) => {
  let runs: { start: number; value: string }[] = [];
  if (candidate.trigger && !text.includes(candidate.trigger)) return runs;

  let pattern = candidate.pattern;
  pattern.lastIndex = 0;

  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    if (!match[0].length) {
      pattern.lastIndex++;
      continue;
    }

    runs.push({ start: match.index, value: match[0] });
  }

  return runs;
};

// Decoded pieces always point at the raw span of the outermost encoded run, so a finding inside a
// base64-in-base64 payload still maps to the characters a reviewer can see.
export let decodeView = (text: string, range?: DecodeRange): DecodedPiece[] => {
  let pieces: DecodedPiece[] = [];
  let budget = DECODE_BUDGET_CHARS_PER_WINDOW;
  let topRange = range ?? { start: 0, end: text.length, ownedEnd: text.length };

  let visit = (
    source: string,
    outer: { rawStart: number; rawEnd: number } | null,
    depth: number
  ) => {
    for (let candidate of CANDIDATES) {
      let runs = outer
        ? findNestedRuns(source, candidate)
        : findTopLevelRuns(source, topRange, candidate);

      for (let run of runs) {
        if (budget <= 0) return;
        if (run.value.length < candidate.minChars) continue;
        if (run.value.length > DECODE_MAX_CANDIDATE_CHARS) continue;

        let decoded = candidate.decode(run.value);
        budget -= run.value.length;

        if (decoded == run.value || !isPrintableText(decoded)) continue;

        let span = outer ?? { rawStart: run.start, rawEnd: run.start + run.value.length };

        pieces.push({ ...span, encoding: candidate.encoding, depth, text: decoded });

        if (depth < DECODE_MAX_DEPTH) visit(decoded, span, depth + 1);
      }
    }
  };

  visit(text, null, 1);

  return pieces;
};
