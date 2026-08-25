import { describe, expect, it } from 'vitest';

import {
  DestinationManifest,
  signatureForBytes,
  signatureForStoredFile
} from './manifest';

let bytes = (value: string) => new TextEncoder().encode(value);

describe('signatures', () => {
  it('identifies a stored file by oid without reading it', () => {
    expect(signatureForStoredFile(42n)).toBe('file:42');
  });

  it('gives identical bytes the same signature', () => {
    expect(signatureForBytes(bytes('hello'))).toBe(signatureForBytes(bytes('hello')));
  });

  it('gives different bytes different signatures', () => {
    expect(signatureForBytes(bytes('hello'))).not.toBe(signatureForBytes(bytes('world')));
  });

  it('never confuses a stored file with generated content', () => {
    expect(signatureForStoredFile(42n)).not.toBe(signatureForBytes(bytes('42')));
  });
});

describe('DestinationManifest', () => {
  it('writes a path it has never seen', () => {
    let manifest = new DestinationManifest();

    expect(manifest.register('/a.md', 'sha256:aaa').shouldWrite).toBe(true);
  });

  it('skips a path whose signature is unchanged', () => {
    let manifest = new DestinationManifest([{ path: '/a.md', signature: 'sha256:aaa' }]);

    expect(manifest.register('/a.md', 'sha256:aaa').shouldWrite).toBe(false);
  });

  it('writes a path whose signature changed', () => {
    let manifest = new DestinationManifest([{ path: '/a.md', signature: 'sha256:aaa' }]);

    expect(manifest.register('/a.md', 'sha256:bbb').shouldWrite).toBe(true);
  });

  it('keeps skipped paths so the prune does not delete them', () => {
    let manifest = new DestinationManifest([
      { path: '/big.bin', signature: 'file:1' },
      { path: '/a.md', signature: 'sha256:aaa' }
    ]);

    manifest.register('/big.bin', 'file:1');
    manifest.register('/a.md', 'sha256:changed');

    // This is the property that makes skipping safe.
    expect(manifest.keepPaths().sort()).toEqual(['/a.md', '/big.bin']);
  });

  it('reports the signature of every desired path, written or skipped', () => {
    let manifest = new DestinationManifest([{ path: '/big.bin', signature: 'file:1' }]);

    manifest.register('/big.bin', 'file:1');
    manifest.register('/a.md', 'sha256:aaa');

    expect(manifest.entries().sort((a, b) => a.path.localeCompare(b.path))).toEqual([
      { path: '/a.md', signature: 'sha256:aaa' },
      { path: '/big.bin', signature: 'file:1' }
    ]);
  });

  describe('forgetPrefix', () => {
    it('forces a rewrite of content that was explicitly deleted', () => {
      let manifest = new DestinationManifest([
        { path: '/skills/demo/a.md', signature: 'sha256:aaa' }
      ]);

      manifest.forgetPrefix('/skills/demo');

      expect(manifest.register('/skills/demo/a.md', 'sha256:aaa').shouldWrite).toBe(true);
    });

    it('does not match a sibling with a shared name prefix', () => {
      let manifest = new DestinationManifest([
        { path: '/skills/demo-other/a.md', signature: 'sha256:aaa' }
      ]);

      manifest.forgetPrefix('/skills/demo');

      expect(manifest.register('/skills/demo-other/a.md', 'sha256:aaa').shouldWrite).toBe(
        false
      );
    });

    it('drops paths registered before the delete', () => {
      let manifest = new DestinationManifest();

      manifest.register('/skills/demo/a.md', 'sha256:aaa');
      manifest.forgetPrefix('/skills/demo');

      expect(manifest.keepPaths()).toEqual([]);
    });
  });

  describe('removedPaths', () => {
    it('reports what the prune deleted', () => {
      let manifest = new DestinationManifest([
        { path: '/gone.md', signature: 'sha256:aaa' }
      ]);

      expect(manifest.removedPaths(['/gone.md'])).toEqual(['/gone.md']);
    });

    it('reports explicitly deleted paths the prune never saw', () => {
      let manifest = new DestinationManifest([
        { path: '/skills/demo/a.md', signature: 'sha256:aaa' }
      ]);

      manifest.forgetPrefix('/skills/demo');

      expect(manifest.removedPaths([])).toEqual(['/skills/demo/a.md']);
    });

    it('does not remove a path this run rewrote', () => {
      let manifest = new DestinationManifest([{ path: '/a.md', signature: 'sha256:aaa' }]);

      manifest.register('/a.md', 'sha256:bbb');

      // A stale prune report must not drop a row we just refreshed.
      expect(manifest.removedPaths(['/a.md'])).toEqual([]);
    });

    it('leaves paths owned by other sync tasks alone', () => {
      // The manifest covers the whole destination, but a task only owns one
      // subtree, so untouched paths must survive.
      let manifest = new DestinationManifest([
        { path: '/skills/mine/a.md', signature: 'sha256:aaa' },
        { path: '/skills/theirs/b.md', signature: 'sha256:bbb' }
      ]);

      manifest.register('/skills/mine/a.md', 'sha256:changed');

      expect(manifest.removedPaths([])).toEqual([]);
    });
  });
});
