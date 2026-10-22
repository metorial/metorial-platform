import { ServiceError } from '@lowerdeck/error';
import { describe, expect, it } from 'vitest';
import { normalizeStorePath, type StorePathKind } from './storePath';

let legacy = (path: string | undefined, kind: StorePathKind = 'file') =>
  normalizeStorePath({ path, kind, mode: 'legacy' });

let unicode = (path: string | undefined, kind: StorePathKind = 'file') =>
  normalizeStorePath({ path, kind, mode: 'unicode' });

let captureError = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    if (error instanceof ServiceError) return error.data;
    throw error;
  }

  throw new Error('Expected a ServiceError');
};

let createRandom = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;

  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
};

let pick = <T>(random: () => number, values: readonly T[]) =>
  values[Math.floor(random() * values.length)]!;

let legacyCharacters = Array.from(
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._() -$'
);

let inputCharacters = [
  ...legacyCharacters,
  ...Array.from('/\\//..  :?*<>|"\'#@[]{}+,;=!~`^%&\t\r\n\u0000'),
  ...Array.from('éèüßñçøÅ日本語ファイル한국어عربيΩЖ'),
  'e\u0301',
  '🚀',
  '\u00a0'
];

describe('normalizeStorePath', () => {
  describe('legacy mode', () => {
    it('strips every character outside the ASCII allow-list', () => {
      expect(legacy('résumé.txt').path).toBe('/rsum.txt');
      expect(legacy('rèsumè.txt').path).toBe('/rsum.txt');
      expect(legacy('we<i>rd|na:me?*.txt').path).toBe('/weirdname.txt');
      expect(legacy('nul\u0000byte\r\n.txt').path).toBe('/nulbyte.txt');
    });

    it('rejects file paths that strip down to nothing', () => {
      for (let path of ['日本語', '?*<>', '../..', '///', '   ', '']) {
        expect(captureError(() => legacy(path)).code, path).toBe('bad_request');
      }
    });
  });

  describe('unicode mode', () => {
    it('keeps unicode letters, marks and digits', () => {
      expect(unicode('résumé.txt').path).toBe('/résumé.txt');
      expect(unicode('rèsumè.txt').path).toBe('/rèsumè.txt');
      expect(unicode('日本語/ファイル٣.txt')).toMatchObject({
        path: '/日本語/ファイル٣.txt',
        name: 'ファイル٣.txt',
        parentPath: '/日本語/',
        segments: ['日本語', 'ファイル٣.txt']
      });
      expect(unicode('सूची.md').path).toBe('/सूची.md');
    });

    it('keeps punctuation and emoji that filesystems and object keys accept', () => {
      for (let name of [
        'c++.md',
        '[id].tsx',
        '@scope',
        'a,b;c=d.md',
        "it's 1 & ~done!.txt",
        '{x}^`.txt',
        'rocket🚀.txt',
        'family👨\u200d👩\u200d👧.txt'
      ]) {
        expect(unicode(`dir/${name}`).name, name).toBe(name);
      }
    });

    it('composes each segment to NFC', () => {
      let decomposed = unicode('cafe\u0301/re\u0301sume\u0301.txt');

      expect(decomposed.path).toBe('/caf\u00e9/r\u00e9sum\u00e9.txt');
      expect(decomposed.path).toBe(unicode('café/résumé.txt').path);
    });

    it('normalizes separators, traversal and whitespace like legacy mode', () => {
      let cases: [string, StorePathKind, string][] = [
        ['../../etc/passwd.txt', 'file', '/etc/passwd.txt'],
        ['a/./b/../c.txt', 'file', '/a/b/c.txt'],
        ['..\\..\\windows\\évil.txt', 'file', '/windows/évil.txt'],
        ['....//...//dots.txt', 'file', '/dots.txt'],
        ['  spaced  / name .txt ', 'file', '/spaced/name .txt'],
        ['//double//slashes//f.txt', 'file', '/double/slashes/f.txt'],
        ['/', 'directory', '/'],
        ['../../', 'directory', '/'],
        ['docs/ünterordner', 'directory', '/docs/ünterordner/']
      ];

      for (let [input, kind, expected] of cases) {
        expect(unicode(input, kind).path, input).toBe(expected);
      }
    });

    it('rejects a disallowed character and names it', () => {
      let cases: [string, string][] = [
        ['we<i>rd.txt', '"<" (U+003C)'],
        ['dir/na:me.txt', '":" (U+003A)'],
        ['what?.txt', '"?" (U+003F)'],
        ['star*.txt', '"*" (U+002A)'],
        ['quo"te.txt', '"\\"" (U+0022)'],
        ['pi|pe.txt', '"|" (U+007C)'],
        ['notes#1.txt', '"#" (U+0023)'],
        ['100%.txt', '"%" (U+0025)'],
        ['nul\u0000byte.txt', '"\\u0000" (U+0000)'],
        ['tab\tinside.txt', '"\\t" (U+0009)'],
        ['non\u00a0breaking.txt', '"\u00a0" (U+00A0)'],
        ['zero\u200bwidth.txt', '"\u200b" (U+200B)'],
        ['bidi\u202eflip.txt', '"\u202e" (U+202E)'],
        ['line\u2028sep.txt', '"\u2028" (U+2028)']
      ];

      for (let [path, character] of cases) {
        let error = captureError(() => unicode(path));

        expect(error.code, path).toBe('bad_request');
        expect(error.message, path).toBe(
          `Store item path contains a character that is not allowed: ${character}`
        );
      }
    });

    it('rejects empty paths and file paths without a file name', () => {
      for (let path of [undefined, '', '   ', '../..', '///', './.']) {
        expect(captureError(() => unicode(path)).code, String(path)).toBe('bad_request');
      }
    });
  });

  it('maps every path that is valid in legacy mode to itself in unicode mode', () => {
    let random = createRandom(47);
    let checked = 0;

    for (let iteration = 0; iteration < 5000; iteration++) {
      let length = 1 + Math.floor(random() * 30);
      let input = Array.from({ length }, () => pick(random, inputCharacters)).join('');
      let kind = pick(random, ['file', 'directory'] as const);

      let legacyPath: string;
      try {
        legacyPath = legacy(input, kind).path;
        if (legacy(legacyPath, kind).path !== legacyPath) continue;
      } catch {
        continue;
      }

      expect(unicode(legacyPath, kind).path, JSON.stringify(input)).toBe(legacyPath);
      checked++;
    }

    for (let iteration = 0; iteration < 2000; iteration++) {
      let segments = Array.from({ length: 1 + Math.floor(random() * 4) }, () =>
        Array.from({ length: 1 + Math.floor(random() * 12) }, () =>
          pick(random, legacyCharacters)
        ).join('')
      );
      let kind = pick(random, ['file', 'directory'] as const);
      let candidate = `/${segments.join('/')}${kind === 'directory' ? '/' : ''}`;

      let legacyPath: string;
      try {
        legacyPath = legacy(candidate, kind).path;
      } catch {
        continue;
      }

      if (legacyPath !== candidate) continue;

      expect(unicode(candidate, kind)).toEqual(legacy(candidate, kind));
      checked++;
    }

    expect(checked).toBeGreaterThan(2000);
  });
});
