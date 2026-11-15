import { createHash } from 'node:crypto';

export type ContentSignature = string;

export let signatureForStoredFile = (fileOid: bigint): ContentSignature =>
  `file:${fileOid.toString()}`;

export let signatureForBytes = (content: Uint8Array): ContentSignature =>
  `sha256:${createHash('sha256').update(content).digest('hex')}`;

export let normalizeBucketPath = (inPath: string) => {
  if (!inPath) return '/';

  let segments = inPath.split('/').filter(segment => segment && segment !== '.');
  let normalized: string[] = [];

  for (let segment of segments) {
    if (segment === '..') normalized.pop();
    else normalized.push(segment);
  }

  return `/${normalized.join('/')}`;
};

export interface DestinationManifestEntry {
  path: string;
  signature: ContentSignature;
  itemKey?: string | null;
}

// Rows written in manifest mode store paths without the leading slash the code bucket uses, so
// every recorded path is compared in bucket form.
export class DestinationManifest {
  private previous: Map<string, ContentSignature>;
  private desired = new Map<string, ContentSignature>();
  private explicitlyRemoved = new Set<string>();

  private owned = new Set<string>();

  constructor(
    entries: Iterable<DestinationManifestEntry> = [],
    private itemKey?: string | null
  ) {
    this.previous = new Map();
    for (let entry of entries) {
      let path = normalizeBucketPath(entry.path);

      this.previous.set(path, entry.signature);
      if (itemKey && entry.itemKey === itemKey) this.owned.add(path);
    }
  }

  register(path: string, signature: ContentSignature): { shouldWrite: boolean } {
    let normalized = normalizeBucketPath(path);
    this.desired.set(normalized, signature);

    return { shouldWrite: this.previous.get(normalized) !== signature };
  }

  forgetPrefix(prefix: string) {
    let normalizedPrefix = normalizeBucketPath(prefix);

    for (let path of [...this.previous.keys()]) {
      if (!isUnderPrefix(path, normalizedPrefix)) continue;

      this.previous.delete(path);
      this.explicitlyRemoved.add(path);
    }

    for (let path of [...this.desired.keys()]) {
      if (isUnderPrefix(path, normalizedPrefix)) this.desired.delete(path);
    }
  }

  keepPaths(): string[] {
    return [...this.desired.keys()];
  }

  entries(): Array<{ path: string; signature: ContentSignature }> {
    return [...this.desired].map(([path, signature]) => ({ path, signature }));
  }

  abandonedPaths(): string[] {
    return [...this.owned].filter(path => !this.desired.has(path));
  }

  removedPaths(prunedPaths: string[]): string[] {
    let removed = new Set([
      ...prunedPaths.map(normalizeBucketPath),
      ...this.explicitlyRemoved,
      ...this.abandonedPaths()
    ]);

    for (let path of this.desired.keys()) removed.delete(path);

    return [...removed];
  }
}

let isUnderPrefix = (path: string, prefix: string) =>
  path === prefix || path.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`);
