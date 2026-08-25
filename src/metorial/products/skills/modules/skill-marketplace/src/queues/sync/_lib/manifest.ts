import { createHash } from 'node:crypto';

/**
 * Identifies the content at a path without necessarily reading it.
 *
 * Stored files are immutable, so their oid alone proves the content: a 100MB
 * asset can be diffed without transferring a byte. Generated content -- rendered
 * documents including their frontmatter, and the JSON manifests -- is hashed,
 * which is safe because it is already in memory and bounded by the document
 * character limit.
 */
export type ContentSignature = string;

export let signatureForStoredFile = (fileOid: bigint): ContentSignature =>
  `file:${fileOid.toString()}`;

export let signatureForBytes = (content: Uint8Array): ContentSignature =>
  `sha256:${createHash('sha256').update(content).digest('hex')}`;

/**
 * Decides which paths a sync actually has to upload.
 *
 * Every desired path is returned as a keep path, whether or not it is being
 * written. That is what makes skipping safe: the prune removes anything outside
 * the keep set, so an unchanged file that we deliberately did not rewrite must
 * still be named, or the prune would delete it.
 */
export class DestinationManifest {
  private previous: Map<string, ContentSignature>;
  private desired = new Map<string, ContentSignature>();
  private explicitlyRemoved = new Set<string>();

  constructor(entries: Iterable<{ path: string; signature: ContentSignature }> = []) {
    this.previous = new Map();
    for (let entry of entries) this.previous.set(entry.path, entry.signature);
  }

  /**
   * Records that `path` should hold content with `signature`, and reports
   * whether it has to be uploaded.
   */
  register(path: string, signature: ContentSignature): { shouldWrite: boolean } {
    this.desired.set(path, signature);

    return { shouldWrite: this.previous.get(path) !== signature };
  }

  /**
   * Forgets a subtree the serializer explicitly deleted, so a later sync
   * rewrites it rather than trusting signatures for content that is gone.
   */
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

  /** Every path this run wants present, written or skipped. */
  keepPaths(): string[] {
    return [...this.desired.keys()];
  }

  entries(): Array<{ path: string; signature: ContentSignature }> {
    return [...this.desired].map(([path, signature]) => ({ path, signature }));
  }

  /**
   * Rows that no longer describe anything in the bucket.
   *
   * A sync task only owns one subtree, while the manifest covers the whole
   * destination, so this is driven by what the prune actually deleted and by
   * explicit deletions rather than by "everything this task did not write".
   */
  removedPaths(prunedPaths: string[]): string[] {
    let removed = new Set([...prunedPaths, ...this.explicitlyRemoved]);

    // A path the prune reported but that this run rewrote is not removed.
    for (let path of this.desired.keys()) removed.delete(path);

    return [...removed];
  }
}

let isUnderPrefix = (path: string, prefix: string) =>
  path === prefix || path.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`);
