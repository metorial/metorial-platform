import { createHash } from 'node:crypto';

export type ContentSignature = string;

export let signatureForStoredFile = (fileOid: bigint): ContentSignature =>
  `file:${fileOid.toString()}`;

export let signatureForBytes = (content: Uint8Array): ContentSignature =>
  `sha256:${createHash('sha256').update(content).digest('hex')}`;

export interface DestinationManifestEntry {
  path: string;
  signature: ContentSignature;
  itemKey?: string | null;
}

export class DestinationManifest {
  private previous: Map<string, ContentSignature>;
  private desired = new Map<string, ContentSignature>();
  private explicitlyRemoved = new Set<string>();

  /**
   * Paths the item being applied held before this run. Used to catch removals
   * the code bucket prune cannot see, either because they sit outside the
   * item's prune scope or because the prune was skipped.
   */
  private owned = new Set<string>();

  constructor(
    entries: Iterable<DestinationManifestEntry> = [],
    private itemKey?: string | null
  ) {
    this.previous = new Map();
    for (let entry of entries) {
      this.previous.set(entry.path, entry.signature);
      if (itemKey && entry.itemKey === itemKey) this.owned.add(entry.path);
    }
  }

  register(path: string, signature: ContentSignature): { shouldWrite: boolean } {
    this.desired.set(path, signature);

    return { shouldWrite: this.previous.get(path) !== signature };
  }

  forgetPrefix(prefix: string) {
    for (let path of [...this.previous.keys()]) {
      if (!isUnderPrefix(path, prefix)) continue;

      this.previous.delete(path);
      this.explicitlyRemoved.add(path);
    }

    for (let path of [...this.desired.keys()]) {
      if (isUnderPrefix(path, prefix)) this.desired.delete(path);
    }
  }

  keepPaths(): string[] {
    return [...this.desired.keys()];
  }

  entries(): Array<{ path: string; signature: ContentSignature }> {
    return [...this.desired].map(([path, signature]) => ({ path, signature }));
  }

  /**
   * Paths the current item used to own and no longer writes. The caller has to
   * delete these from the bucket itself, since the prune only covers the item's
   * own scope.
   */
  abandonedPaths(): string[] {
    return [...this.owned].filter(path => !this.desired.has(path));
  }

  removedPaths(prunedPaths: string[]): string[] {
    let removed = new Set([
      ...prunedPaths,
      ...this.explicitlyRemoved,
      ...this.abandonedPaths()
    ]);

    for (let path of this.desired.keys()) removed.delete(path);

    return [...removed];
  }
}

let isUnderPrefix = (path: string, prefix: string) =>
  path === prefix || path.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`);
