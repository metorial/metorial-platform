import { createHash } from 'node:crypto';

export type ContentSignature = string;

export let signatureForStoredFile = (fileOid: bigint): ContentSignature =>
  `file:${fileOid.toString()}`;

export let signatureForBytes = (content: Uint8Array): ContentSignature =>
  `sha256:${createHash('sha256').update(content).digest('hex')}`;

export class DestinationManifest {
  private previous: Map<string, ContentSignature>;
  private desired = new Map<string, ContentSignature>();
  private explicitlyRemoved = new Set<string>();

  constructor(entries: Iterable<{ path: string; signature: ContentSignature }> = []) {
    this.previous = new Map();
    for (let entry of entries) this.previous.set(entry.path, entry.signature);
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

  removedPaths(prunedPaths: string[]): string[] {
    let removed = new Set([...prunedPaths, ...this.explicitlyRemoved]);

    for (let path of this.desired.keys()) removed.delete(path);

    return [...removed];
  }
}

let isUnderPrefix = (path: string, prefix: string) =>
  path === prefix || path.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`);
