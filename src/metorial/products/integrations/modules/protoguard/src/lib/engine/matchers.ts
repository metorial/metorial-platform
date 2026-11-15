import { canonicalize, foldAsciiCharCode } from './normalize';

let WORD_CHAR = /[\p{L}\p{N}_]/u;

export interface PhraseMatch {
  start: number;
  end: number;
  phraseIndex: number;
}

interface AutomatonNode {
  next: Map<number, number>;
  fail: number;
  outputs: number[];
}

let isSpaceCode = (code: number) =>
  code == 0x20 || (code >= 0x09 && code <= 0x0d) || code == 0xa0;

// Phrases are stored in canonical form. Against raw text the automaton applies the canonical ASCII
// fold and collapses whitespace runs on the fly, so plain-ASCII attacks are still caught in windows
// where building the full canonical view is too expensive.
export class PhraseMatcher {
  private nodes: AutomatonNode[] = [{ next: new Map(), fail: 0, outputs: [] }];
  private lengths: number[] = [];
  private maxLength = 0;

  constructor(readonly phrases: string[]) {
    phrases.forEach((phrase, index) => this.insert(canonicalize(phrase).text.trim(), index));
    this.link();
  }

  private insert(phrase: string, index: number) {
    if (!phrase.length) throw new Error(`Empty phrase at index ${index}`);

    let state = 0;
    for (let i = 0; i < phrase.length; i++) {
      let code = phrase.charCodeAt(i);
      let next = this.nodes[state]!.next.get(code);

      if (next === undefined) {
        next = this.nodes.length;
        this.nodes.push({ next: new Map(), fail: 0, outputs: [] });
        this.nodes[state]!.next.set(code, next);
      }

      state = next;
    }

    this.nodes[state]!.outputs.push(index);
    this.lengths[index] = phrase.length;
    this.maxLength = Math.max(this.maxLength, phrase.length);
  }

  private link() {
    let queue: number[] = [];

    for (let child of this.nodes[0]!.next.values()) queue.push(child);

    for (let head = 0; head < queue.length; head++) {
      let state = queue[head]!;
      let node = this.nodes[state]!;

      for (let [code, child] of node.next) {
        let fail = node.fail;
        while (fail && !this.nodes[fail]!.next.has(code)) fail = this.nodes[fail]!.fail;

        let target = this.nodes[fail]!.next.get(code);
        let childNode = this.nodes[child]!;
        childNode.fail = target !== undefined && target != child ? target : 0;
        childNode.outputs.push(...this.nodes[childNode.fail]!.outputs);

        queue.push(child);
      }
    }
  }

  find(text: string, d: { limit: number; until?: number }) {
    let matches: PhraseMatch[] = [];
    let until = d.until ?? text.length;
    let ring = new Int32Array(Math.max(1, this.maxLength));
    let fed = 0;
    let state = 0;
    let lastWasSpace = true;

    for (let i = 0; i < text.length; i++) {
      let raw = text.charCodeAt(i);
      let code = foldAsciiCharCode(raw);

      if (isSpaceCode(raw)) {
        if (lastWasSpace) continue;
        code = 0x20;
        lastWasSpace = true;
      } else {
        lastWasSpace = false;
      }

      ring[fed % ring.length] = i;
      fed++;

      while (state && !this.nodes[state]!.next.has(code)) state = this.nodes[state]!.fail;
      state = this.nodes[state]!.next.get(code) ?? 0;

      for (let phraseIndex of this.nodes[state]!.outputs) {
        let length = this.lengths[phraseIndex]!;
        let start = ring[(fed - length) % ring.length]!;
        let end = i + 1;

        if (start >= until) continue;
        if (start > 0 && WORD_CHAR.test(text[start - 1]!)) continue;
        if (end < text.length && WORD_CHAR.test(text[end]!)) continue;

        matches.push({ start, end, phraseIndex });
        if (matches.length >= d.limit) return matches;
      }
    }

    return matches;
  }
}

export interface RegexMatch {
  start: number;
  end: number;
  groups: string[];
}

export let findRegexMatches = (
  pattern: RegExp,
  text: string,
  d: { limit: number; until?: number }
) => {
  let matches: RegexMatch[] = [];
  let until = d.until ?? text.length;
  let regex = pattern.global ? pattern : new RegExp(pattern.source, `${pattern.flags}g`);
  regex.lastIndex = 0;

  for (let match = regex.exec(text); match; match = regex.exec(text)) {
    if (!match[0].length) {
      regex.lastIndex++;
      continue;
    }
    if (match.index >= until) break;

    matches.push({
      start: match.index,
      end: match.index + match[0].length,
      groups: match.slice(1).map(group => group ?? '')
    });
    if (matches.length >= d.limit) break;
  }

  return matches;
};

export type RegexLintIssue = 'backreference' | 'lookaround' | 'nested_quantifier';

// Rulesets must stay within the RE2-compatible subset so a pathological input cannot make a single
// regex run super-linear. The lint is a conservative scan of the pattern source, not a full parser.
export let lintRegex = (source: string): RegexLintIssue[] => {
  let issues = new Set<RegexLintIssue>();
  let groupHasUnboundedQuantifier: boolean[] = [];
  let inClass = false;

  for (let i = 0; i < source.length; i++) {
    let char = source[i]!;

    if (char == '\\') {
      let next = source[i + 1] ?? '';
      if (!inClass && (/[1-9]/.test(next) || next == 'k')) issues.add('backreference');
      i++;
      continue;
    }

    if (inClass) {
      if (char == ']') inClass = false;
      continue;
    }

    if (char == '[') {
      inClass = true;
      continue;
    }

    if (char == '(') {
      if (/^\?(?:=|!|<=|<!)/.test(source.slice(i + 1, i + 4))) issues.add('lookaround');
      groupHasUnboundedQuantifier.push(false);
      continue;
    }

    let isUnbounded =
      char == '*' || char == '+' || (char == '{' && /^\{\d+,\}/.test(source.slice(i)));

    if (char == ')') {
      let hadUnbounded = groupHasUnboundedQuantifier.pop() ?? false;
      let quantifier = source.slice(i + 1);
      let isQuantified = /^(?:[*+?]|\{\d+(?:,\d*)?\})/.test(quantifier);

      if (hadUnbounded && isQuantified) issues.add('nested_quantifier');
      if (hadUnbounded && groupHasUnboundedQuantifier.length) {
        groupHasUnboundedQuantifier[groupHasUnboundedQuantifier.length - 1] = true;
      }
      continue;
    }

    if (isUnbounded && groupHasUnboundedQuantifier.length) {
      groupHasUnboundedQuantifier[groupHasUnboundedQuantifier.length - 1] = true;
    }
  }

  return [...issues];
};
