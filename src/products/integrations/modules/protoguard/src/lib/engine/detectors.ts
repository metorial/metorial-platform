import { MAX_MATCHES_PER_RULE_PER_WINDOW } from './budget';
import { findRegexMatches, PhraseMatcher } from './matchers';
import { decodeTagCharacters } from './normalize';
import type { DetectInput, RawMatch } from './types';

let TAG_RUN_MIN_CODE_POINTS = 4;
let INVISIBLE_CLUSTER_MIN = 3;
let INVISIBLE_CLUSTER_MAX_GAP = 3;

let EXFIL_QUERY_LONG_CHARS = 100;
let EXFIL_ENTROPY_MIN_VALUE_CHARS = 32;
let EXFIL_ENTROPY_BITS = 4;

let TOOL_NAME_MIN_CHARS = 6;
let TOOL_REFERENCE_VERB_WINDOW = 48;
let TOOL_MATCHER_CACHE_SIZE = 64;

let TYPOGLYCEMIA_WORDS = ['ignore', 'bypass', 'override', 'reveal', 'system', 'instructions'];

let BLACK_FLAG = 0x1f3f4;
let TAG_CANCEL = 0xe007f;

let isTagCodePoint = (cp: number) => cp >= 0xe0000 && cp <= 0xe007f;

let isClusterInvisible = (cp: number) =>
  (cp >= 0x200b && cp <= 0x200f) ||
  (cp >= 0x2060 && cp <= 0x2064) ||
  cp == 0xfeff ||
  cp == 0x180e ||
  cp == 0x034f;

let isPictographic = (char: string | undefined) =>
  !!char && /\p{Extended_Pictographic}/u.test(char);

let codePointBefore = (text: string, index: number) => {
  if (index <= 0) return undefined;
  let low = text.charCodeAt(index - 1);
  let isLowSurrogate = low >= 0xdc00 && low <= 0xdfff && index >= 2;
  return isLowSurrogate ? text.slice(index - 2, index) : text[index - 1];
};

let codePointAt = (text: string, index: number) => {
  let cp = text.codePointAt(index);
  return cp === undefined ? undefined : String.fromCodePoint(cp);
};

// Emoji subdivision flags (England, Scotland, Wales) are U+1F3F4 followed by tag characters and a
// cancel tag. Any other run of four or more tag characters is invisible ASCII smuggling.
export let detectTagRuns = (d: DetectInput): RawMatch[] => {
  let matches: RawMatch[] = [];
  let text = d.text;

  for (let i = 0; i < text.length && matches.length < MAX_MATCHES_PER_RULE_PER_WINDOW;) {
    let cp = text.codePointAt(i)!;
    if (!isTagCodePoint(cp)) {
      i += cp > 0xffff ? 2 : 1;
      continue;
    }

    let start = i;
    let count = 0;
    let lastCodePoint = cp;

    while (i < text.length) {
      let next = text.codePointAt(i)!;
      if (!isTagCodePoint(next)) break;

      lastCodePoint = next;
      count++;
      i += 2;
    }

    let before = codePointBefore(text, start)?.codePointAt(0);
    let isFlag = before == BLACK_FLAG && lastCodePoint == TAG_CANCEL;

    if (count >= TAG_RUN_MIN_CODE_POINTS && !isFlag) {
      matches.push({
        start,
        end: i,
        decodedSample: decodeTagCharacters(text.slice(start, i))
      });
    }
  }

  return matches;
};

export let detectInvisibleClusters = (d: DetectInput): RawMatch[] => {
  let matches: RawMatch[] = [];
  let text = d.text;

  let clusterStart = -1;
  let clusterEnd = -1;
  let clusterCount = 0;

  let flush = () => {
    if (clusterCount >= INVISIBLE_CLUSTER_MIN) {
      matches.push({ start: clusterStart, end: clusterEnd });
    }

    clusterStart = -1;
    clusterCount = 0;
  };

  for (let i = 0; i < text.length && matches.length < MAX_MATCHES_PER_RULE_PER_WINDOW; i++) {
    let cp = text.charCodeAt(i);
    if (!isClusterInvisible(cp)) continue;

    let isEmojiJoiner =
      cp == 0x200d &&
      isPictographic(codePointBefore(text, i)) &&
      isPictographic(codePointAt(text, i + 1));
    let isLeadingBom = cp == 0xfeff && i == 0;
    if (isEmojiJoiner || isLeadingBom) continue;

    if (clusterStart >= 0 && i - clusterEnd > INVISIBLE_CLUSTER_MAX_GAP) flush();

    if (clusterStart < 0) clusterStart = i;
    clusterEnd = i + 1;
    clusterCount++;
  }

  flush();

  return matches;
};

let shannonEntropy = (value: string) => {
  let counts = new Map<string, number>();
  for (let char of value) counts.set(char, (counts.get(char) ?? 0) + 1);

  let entropy = 0;
  for (let count of counts.values()) {
    let p = count / value.length;
    entropy -= p * Math.log2(p);
  }

  return entropy;
};

let EXFIL_PLACEHOLDER =
  /\{\{|\$\{|%7b%7b|\{[a-z_ ]{2,40}\}|%7b[a-z_ ]{2,40}%7d|<[a-z_ ]{2,40}>|%3c[a-z_ ]{2,40}%3e|\[(?:data|secret|info|summary|conversation|history|context)\]|insert[_ -]?here|(?:conversation|chat)[_ -]?history|user[_ -]?(?:data|info|secret)/i;

let EXFIL_IMAGE_MARKDOWN = /!\[[^\]\n]{0,200}\]\(\s{0,4}<?(https?:\/\/[^\s)>]{1,2048})/gi;
let EXFIL_IMAGE_HTML =
  /<img\b[^>]{0,500}?\bsrc\s{0,4}=\s{0,4}["']?(https?:\/\/[^\s"'>]{1,2048})/gi;
let EXFIL_LINK_MARKDOWN = /\[[^\]\n]{0,200}\]\(\s{0,4}<?(https?:\/\/[^\s)>]{1,2048})/gi;

let classifyExfilUrl = (url: string) => {
  if (EXFIL_PLACEHOLDER.test(url)) return 'placeholder' as const;

  let queryStart = url.indexOf('?');
  if (queryStart < 0) return null;

  let query = url.slice(queryStart + 1);
  if (query.length >= EXFIL_QUERY_LONG_CHARS) return 'data' as const;

  for (let pair of query.split('&')) {
    let value = pair.slice(pair.indexOf('=') + 1);
    if (value.length < EXFIL_ENTROPY_MIN_VALUE_CHARS) continue;
    if (shannonEntropy(value) >= EXFIL_ENTROPY_BITS) return 'data' as const;
  }

  return null;
};

let urlMatches = (regex: RegExp, text: string) =>
  findRegexMatches(regex, text, { limit: MAX_MATCHES_PER_RULE_PER_WINDOW }).map(match => ({
    ...match,
    url: match.groups[0] ?? ''
  }));

export let detectExfilImages = (d: DetectInput): RawMatch[] => {
  let matches: RawMatch[] = [];

  let candidates = [
    ...urlMatches(EXFIL_IMAGE_MARKDOWN, d.text),
    ...urlMatches(EXFIL_IMAGE_HTML, d.text)
  ];

  for (let candidate of candidates) {
    let kind = classifyExfilUrl(candidate.url);
    if (!kind) continue;

    matches.push(
      kind == 'placeholder'
        ? {
            start: candidate.start,
            end: candidate.end,
            hardRule: true,
            description: 'Image URL contains a placeholder for data to exfiltrate.'
          }
        : {
            start: candidate.start,
            end: candidate.end,
            description: 'Image URL carries a long or high-entropy query string.'
          }
    );
  }

  return matches;
};

export let detectExfilLinks = (d: DetectInput): RawMatch[] =>
  urlMatches(EXFIL_LINK_MARKDOWN, d.text)
    .filter(candidate => candidate.start == 0 || d.text[candidate.start - 1] != '!')
    .filter(candidate => classifyExfilUrl(candidate.url) == 'placeholder')
    .map(candidate => ({ start: candidate.start, end: candidate.end }));

let toolMatcherCache = new Map<string, { matcher: PhraseMatcher; names: string[] }>();

let isDistinctiveToolName = (name: string) =>
  name.length >= TOOL_NAME_MIN_CHARS && /[_\-.\d]|[a-z][A-Z]/.test(name);

let getToolMatcher = (names: string[]) => {
  let key = names.join('\n');
  let cached = toolMatcherCache.get(key);
  if (cached) return cached;

  let entry = { matcher: new PhraseMatcher(names), names };
  if (toolMatcherCache.size >= TOOL_MATCHER_CACHE_SIZE) {
    toolMatcherCache.delete(toolMatcherCache.keys().next().value!);
  }
  toolMatcherCache.set(key, entry);

  return entry;
};

let CALL_VERB = /\b(?:call|use|invoke|run|execute|trigger|then)\s{1,3}(?:the\s{1,3})?[`"']?$/i;

export let detectCrossToolReference = (d: DetectInput): RawMatch[] => {
  let current = d.context.currentToolName ?? null;
  let names = [...new Set(d.context.sessionToolNames ?? [])]
    .filter(name => name != current && isDistinctiveToolName(name))
    .sort();
  if (!names.length) return [];

  let { matcher, names: indexed } = getToolMatcher(names);
  let matches: RawMatch[] = [];

  for (let match of matcher.find(d.text, { limit: MAX_MATCHES_PER_RULE_PER_WINDOW * 4 })) {
    let before = d.text.slice(
      Math.max(0, match.start - TOOL_REFERENCE_VERB_WINDOW),
      match.start
    );
    if (!CALL_VERB.test(before)) continue;

    matches.push({
      start: match.start,
      end: match.end,
      description: `Instructs the agent to call another tool (${indexed[match.phraseIndex]}).`
    });
    if (matches.length >= MAX_MATCHES_PER_RULE_PER_WINDOW) break;
  }

  return matches;
};

let sortedInner = (word: string) => word.slice(1, -1).split('').sort().join('');

let TYPOGLYCEMIA_TARGETS = TYPOGLYCEMIA_WORDS.map(word => ({
  word,
  key: `${word[0]}${word[word.length - 1]}${word.length}:${sortedInner(word)}`
}));

let TYPOGLYCEMIA_KEYS = new Map(TYPOGLYCEMIA_TARGETS.map(target => [target.key, target.word]));

export let detectTypoglycemia = (d: DetectInput): RawMatch[] => {
  let matches: RawMatch[] = [];
  let wordPattern = /\b[a-z]{6,12}\b/g;

  for (
    let match = wordPattern.exec(d.text);
    match && matches.length < MAX_MATCHES_PER_RULE_PER_WINDOW;
    match = wordPattern.exec(d.text)
  ) {
    let word = match[0];
    let key = `${word[0]}${word[word.length - 1]}${word.length}:${sortedInner(word)}`;
    let target = TYPOGLYCEMIA_KEYS.get(key);
    if (!target || target == word) continue;

    matches.push({
      start: match.index,
      end: match.index + word.length,
      description: `Scrambled variant of "${target}".`
    });
  }

  return matches;
};

let DECODED_INSTRUCTION_PATTERNS = [
  /\b(?:ignore|disregard|forget)\s{1,3}(?:all\s{1,3}|any\s{1,3}|the\s{1,3}|your\s{1,3}){0,3}(?:previous|prior|above|earlier)\s{1,3}(?:instructions?|rules?|context|prompts?)\b/i,
  /\bsystem\s{1,3}(?:override|prompt)\b/i,
  /\breveal\s{1,3}(?:your\s{1,3})?(?:system\s{1,3})?(?:prompt|instructions)\b/i,
  /\byou\s{1,3}(?:are\s{1,3}now|must\s{1,3}now)\b/i,
  /\bdeveloper\s{1,3}mode\b/i,
  /<\|im_start\|>|\[INST\]/i
];

export let detectDecodedInstruction = (d: DetectInput): RawMatch[] =>
  DECODED_INSTRUCTION_PATTERNS.some(pattern => pattern.test(d.text))
    ? [{ start: 0, end: d.text.length, decodedSample: d.text }]
    : [];
