import { describe, expect, it } from 'vitest';
import { activeRuleset } from '../../definitions/rulesets';
import { findRegexMatches, lintRegex, PhraseMatcher } from './matchers';

let slices = (text: string, matches: { start: number; end: number }[]) =>
  matches.map(match => text.slice(match.start, match.end));

describe('PhraseMatcher', () => {
  it('matches case-insensitively across whitespace runs', () => {
    let matcher = new PhraseMatcher(['ignore previous', 'system override']);
    let text = 'Please IGNORE \t\n previous stuff. SYSTEM   OVERRIDE now.';

    let matches = matcher.find(text, { limit: 10 });

    expect(slices(text, matches)).toEqual(['IGNORE \t\n previous', 'SYSTEM   OVERRIDE']);
    expect(matches.map(match => match.phraseIndex)).toEqual([0, 1]);
  });

  it('applies the canonical leet fold to raw text', () => {
    let matcher = new PhraseMatcher(['ignore previous']);
    expect(matcher.find('1gn0r3 pr3v10u5', { limit: 10 })).toHaveLength(1);
  });

  it('stores phrases in canonical form', () => {
    let matcher = new PhraseMatcher(['  IGNORE   Previous  ']);
    expect(matcher.find('ignore previous', { limit: 10 })).toHaveLength(1);
  });

  it('enforces word boundaries including unicode letters', () => {
    let matcher = new PhraseMatcher(['ignore previous']);

    expect(matcher.find('xignore previous', { limit: 10 })).toEqual([]);
    expect(matcher.find('ignore previously', { limit: 10 })).toEqual([]);
    expect(matcher.find('éignore previous', { limit: 10 })).toEqual([]);
    expect(matcher.find('(ignore previous)', { limit: 10 })).toHaveLength(1);
  });

  it('reports overlapping phrases through failure links', () => {
    let matcher = new PhraseMatcher(['new directive', 'directive', 'ive']);
    let text = 'a new directive';

    let matches = matcher.find(text, { limit: 10 });

    expect(slices(text, matches).sort()).toEqual(['directive', 'new directive']);
  });

  it('finds a phrase after a partial prefix of another', () => {
    let matcher = new PhraseMatcher(['-x-y', 'x-z']);
    expect(slices('-x-z', matcher.find('-x-z', { limit: 10 }))).toEqual(['x-z']);
  });

  it('respects the limit and the until offset', () => {
    let matcher = new PhraseMatcher(['dan mode']);
    let text = Array.from({ length: 20 }, () => 'dan mode').join(' ');

    expect(matcher.find(text, { limit: 3 })).toHaveLength(3);
    expect(matcher.find(text, { limit: 100, until: 9 }).map(match => match.start)).toEqual([
      0
    ]);
  });

  it('rejects empty phrases', () => {
    expect(() => new PhraseMatcher([''])).toThrow();
    expect(() => new PhraseMatcher(['   '])).toThrow();
    expect(() => new PhraseMatcher(['​'])).toThrow();
  });

  it('scans a megabyte without matches in linear time', () => {
    let matcher = new PhraseMatcher(
      activeRuleset.rules.flatMap(rule =>
        rule.matcher.type == 'phrases' ? rule.matcher.phrases : []
      )
    );
    let text = 'ignore the previous '.repeat(50_000);

    let startedAt = performance.now();
    expect(matcher.find(text, { limit: 10 })).toEqual([]);
    expect(performance.now() - startedAt).toBeLessThan(2000);
  });
});

describe('findRegexMatches', () => {
  it('collects every match of a non-global pattern', () => {
    let matches = findRegexMatches(/a(b)?/, 'a ab a', { limit: 10 });

    expect(matches).toEqual([
      { start: 0, end: 1, groups: [''] },
      { start: 2, end: 4, groups: ['b'] },
      { start: 5, end: 6, groups: [''] }
    ]);
  });

  it('respects the limit and the until offset', () => {
    expect(findRegexMatches(/x/, 'xxxxx', { limit: 2 })).toHaveLength(2);
    expect(findRegexMatches(/x/, 'xxxxx', { limit: 10, until: 3 })).toHaveLength(3);
  });

  it('does not loop on empty matches', () => {
    expect(findRegexMatches(/y*/, 'abc', { limit: 10 })).toEqual([]);
  });

  it('resets a shared global pattern between calls', () => {
    let pattern = /x/g;

    expect(findRegexMatches(pattern, 'x x', { limit: 10 })).toHaveLength(2);
    expect(findRegexMatches(pattern, 'x x', { limit: 10 })).toHaveLength(2);
  });
});

describe('lintRegex', () => {
  it.each([
    ['(a+)+', ['nested_quantifier']],
    ['((a+)b)*', ['nested_quantifier']],
    ['(a{2,})+', ['nested_quantifier']],
    ['(a)\\1', ['backreference']],
    ['(?<n>a)\\k<n>', ['backreference']],
    ['a(?=b)', ['lookaround']],
    ['(?<!a)b', ['lookaround']]
  ])('flags %s', (source, issues) => {
    expect(lintRegex(source)).toEqual(issues);
  });

  it.each(['(a|b)*', '(a{2,5})+', '[\\1]+', '\\d+\\s*', '(?:ab)+c', '[(]+'])(
    'accepts %s',
    source => {
      expect(lintRegex(source)).toEqual([]);
    }
  );

  it('accepts every regex in the active ruleset', () => {
    for (let rule of activeRuleset.rules) {
      if (rule.matcher.type != 'regex') continue;
      expect(lintRegex(rule.matcher.pattern.source), rule.key).toEqual([]);
    }
  });
});
