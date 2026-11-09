import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  compareManifestPaths,
  findCaseInsensitivePathCollisions,
  getManifestPathViolation,
  normalizeManifestPath
} from './pathRules';

type PathRuleCase = { path: string; valid: boolean; reason?: string };

let fixtureUrl = new URL(
  '../../../../../../../../origin/apps/code-bucket/pkg/manifest/testdata/path-rules.json',
  import.meta.url
);

let cases = JSON.parse(readFileSync(fixtureUrl, 'utf8')) as PathRuleCase[];

let compareBytes = (a: string, b: string) => Buffer.compare(Buffer.from(a), Buffer.from(b));

describe('manifest path rules', () => {
  it('loads the fixture shared with Origin', () => {
    expect(cases.length).toBeGreaterThan(50);
  });

  it.each(cases.map(c => [c.path.length > 60 ? `${c.path.slice(0, 60)}…` : c.path, c]))(
    '%s',
    (_name, c) => {
      expect(getManifestPathViolation(c.path)).toBe(c.valid ? null : c.reason);
    }
  );

  it('normalizes to NFC and strips leading slashes', () => {
    expect(normalizeManifestPath('/cafe\u0301/x.md')).toEqual({
      path: 'caf\u00e9/x.md',
      violation: null
    });
    expect(normalizeManifestPath('a/../b').violation).toBe('dot_segment');
  });

  it('sorts in UTF-8 byte order, unlike UTF-16 string comparison', () => {
    let paths = ['b', 'a/b', 'a', '\uffff', '\u{1f680}', 'a0', 'a.b', 'é', 'Z', ''];

    let sorted = [...paths].sort(compareManifestPaths);

    expect(sorted).toEqual([...paths].sort(compareBytes));
    expect(compareManifestPaths('\uffff', '\u{1f680}')).toBeLessThan(0);
    expect('\uffff' < '\u{1f680}').toBe(false);
    expect(compareManifestPaths('a', 'a')).toBe(0);
  });

  it('agrees with byte order on random strings', () => {
    let alphabet = [
      'a',
      'B',
      '/',
      '.',
      '0',
      'é',
      '\u4e2d',
      '\uffff',
      '\u{1f680}',
      '\u{10ffff}'
    ];
    let seed = 1;
    let random = () => {
      seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
      return seed;
    };

    for (let i = 0; i < 2000; i++) {
      let a = Array.from(
        { length: random() % 6 },
        () => alphabet[random() % alphabet.length]
      ).join('');
      let b = Array.from(
        { length: random() % 6 },
        () => alphabet[random() % alphabet.length]
      ).join('');

      expect(Math.sign(compareManifestPaths(a, b))).toBe(Math.sign(compareBytes(a, b)));
    }
  });

  it('reports case-insensitive collisions without rejecting them', () => {
    expect(findCaseInsensitivePathCollisions(['Skill.md', 'skill.md', 'other.md'])).toEqual([
      ['Skill.md', 'skill.md']
    ]);
    expect(getManifestPathViolation('Skill.md')).toBeNull();
  });
});
