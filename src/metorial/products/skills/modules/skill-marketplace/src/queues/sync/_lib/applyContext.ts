import type { ContentHashes } from '@lowerdeck/hash/content';
import { fileService, hasValidContentHashes } from '@metorial/module-file';
import PQueue from 'p-queue';
import {
  normalizeManifestPath,
  type ManifestPathViolation
} from '../../../lib/manifestFile/pathRules';
import type { SerializerContext, StorageBackedFile } from '../../../serializers/_lib/types';

let defaultHashConcurrency = 4;

export type ManifestApplyEntry =
  | { path: string; kind: 'bytes'; bytes: Uint8Array; file?: StorageBackedFile }
  | { path: string; kind: 'file'; file: StorageBackedFile; hashes: ContentHashes };

export type ManifestApplyResult = {
  entries: ManifestApplyEntry[];
  invalidPaths: { path: string; violation: ManifestPathViolation }[];
  oversizedFiles: { path: string; file: StorageBackedFile }[];
  unhashedFiles: { path: string; file: StorageBackedFile }[];
};

let contentToBytes = (content: string | Buffer | ArrayBuffer) => {
  if (typeof content === 'string') return Buffer.from(content, 'utf-8');
  if (content instanceof Buffer) return content;
  return new Uint8Array(content);
};

// Collects what one item's serializer emits instead of writing it anywhere. Rows for the whole
// item are replaced afterwards, so deletePath has nothing to do.
export class ManifestApplyContext implements SerializerContext {
  private basePath = '';
  private slots = new Map<string, { entry?: ManifestApplyEntry }>();
  private invalidPaths: ManifestApplyResult['invalidPaths'] = [];
  private oversizedFiles: ManifestApplyResult['oversizedFiles'] = [];
  private unhashedFiles: ManifestApplyResult['unhashedFiles'] = [];
  private hashing: PQueue;
  private pending: Promise<void>[] = [];

  constructor(
    private opts: {
      inlineHashMaxBytes: number;
      maxFileBytes: number;
      hashConcurrency?: number;
    }
  ) {
    this.hashing = new PQueue({ concurrency: opts.hashConcurrency ?? defaultHashConcurrency });
  }

  setBasePath(path: string | undefined) {
    this.basePath = (path ?? '').replace(/^\/+|\/+$/g, '');
  }

  async setFile(inPath: string, content: string | Buffer | ArrayBuffer) {
    let slot = this.claim(inPath);
    if (!slot) return;

    slot.slot.entry = { path: slot.path, kind: 'bytes', bytes: contentToBytes(content) };
  }

  async setFileFromStorage(inPath: string, file: StorageBackedFile) {
    let slot = this.claim(inPath);
    if (!slot) return;

    if (file.fileSize > this.opts.maxFileBytes) {
      this.oversizedFiles.push({ path: slot.path, file });
      return;
    }

    if (!hasValidContentHashes(file) && file.fileSize > this.opts.inlineHashMaxBytes) {
      this.unhashedFiles.push({ path: slot.path, file });
      return;
    }

    this.pending.push(
      this.hashing.add(async () => {
        let hashes = await fileService.getContentHashes({ file });
        let { pendingContent, ...contentHashes } = hashes;

        slot.slot.entry = pendingContent
          ? { path: slot.path, kind: 'bytes', bytes: pendingContent, file }
          : { path: slot.path, kind: 'file', file, hashes: contentHashes };
      })
    );
  }

  async deletePath(_path: string) {}

  async collect(): Promise<ManifestApplyResult> {
    await Promise.all(this.pending);

    return {
      entries: [...this.slots.values()].flatMap(slot => (slot.entry ? [slot.entry] : [])),
      invalidPaths: this.invalidPaths,
      oversizedFiles: this.oversizedFiles,
      unhashedFiles: this.unhashedFiles
    };
  }

  // The last write to a path wins, in call order, even when an earlier one is still hashing.
  private claim(inPath: string) {
    let relative = inPath.replace(/^\/+/, '');
    let resolved = this.basePath ? `${this.basePath}/${relative}` : relative;
    let { path, violation } = normalizeManifestPath(resolved);

    if (violation) {
      this.invalidPaths.push({ path: resolved, violation });
      return null;
    }

    let slot: { entry?: ManifestApplyEntry } = {};
    this.slots.set(path, slot);
    return { path, slot };
  }
}
