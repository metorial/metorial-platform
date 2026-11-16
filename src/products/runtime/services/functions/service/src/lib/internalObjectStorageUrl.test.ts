import { describe, expect, it } from 'vitest';
import { rewriteObjectStorageUrl } from './internalObjectStorageUrl';

let publicBase = 'https://box.test/object-storage';
let internalBase = 'http://object-storage:8081';

describe('rewriteObjectStorageUrl', () => {
  it('moves a public object URL onto the internal listener and keeps the signature', () => {
    expect(
      rewriteObjectStorageUrl(
        `${publicBase}/forge-artifacts/a%20b/manifest.json?expires=1&purpose=retrieve&signature=ff`,
        publicBase,
        internalBase
      )
    ).toBe(
      `${internalBase}/forge-artifacts/a%20b/manifest.json?expires=1&purpose=retrieve&signature=ff`
    );
  });

  it('tolerates trailing slashes on either base', () => {
    expect(
      rewriteObjectStorageUrl(`${publicBase}/b/k`, `${publicBase}/`, `${internalBase}/`)
    ).toBe(`${internalBase}/b/k`);
  });

  it('leaves other URLs alone', () => {
    expect(rewriteObjectStorageUrl('https://other.test/b/k', publicBase, internalBase)).toBe(
      'https://other.test/b/k'
    );
    expect(rewriteObjectStorageUrl(`${publicBase}x/b/k`, publicBase, internalBase)).toBe(
      `${publicBase}x/b/k`
    );
  });

  it('does nothing unless both bases are configured', () => {
    expect(rewriteObjectStorageUrl(`${publicBase}/b/k`, publicBase, undefined)).toBe(
      `${publicBase}/b/k`
    );
    expect(rewriteObjectStorageUrl(`${publicBase}/b/k`, undefined, internalBase)).toBe(
      `${publicBase}/b/k`
    );
  });
});
