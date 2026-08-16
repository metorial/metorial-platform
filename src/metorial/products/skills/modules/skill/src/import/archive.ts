import JSZip from 'jszip';
import type { SkillImportFileFormat } from '@metorial/db';
import { posix as path } from 'node:path';

export let maxSkillImportArchiveBytes = 10 * 1024 * 1024;
let maxExtractedBytes = 30 * 1024 * 1024;
let maxExtractedFiles = 5000;

export let detectUploadedSkillFileFormat = (file: {
  fileName: string;
  fileType: string;
}): SkillImportFileFormat | null => {
  let extension = path.extname(file.fileName).toLowerCase();
  let mimeType = file.fileType.toLowerCase().split(';')[0]?.trim();
  if (extension === '.zip' || mimeType === 'application/zip') return 'zip';
  if (
    extension === '.md' ||
    extension === '.markdown' ||
    mimeType === 'text/markdown' ||
    mimeType === 'text/plain'
  ) {
    return 'markdown';
  }
  return null;
};

let normalizeArchivePath = (filePath: string) => {
  let normalized = filePath.replaceAll('\\', '/').replace(/^\/+/, '');
  let segments = normalized.split('/').filter(Boolean);
  if (segments.some(segment => segment === '.' || segment === '..')) {
    throw new Error(`Skill archive contains an unsafe path: ${filePath}`);
  }
  return segments.join('/');
};

export let extractSkillArchive = async (archive: Uint8Array) => {
  if (archive.byteLength > maxSkillImportArchiveBytes) {
    throw new Error('Skill archive is too large');
  }

  let zip = await JSZip.loadAsync(archive, { createFolders: false });
  let entries = Object.values(zip.files).filter(entry => !entry.dir);
  if (entries.length > maxExtractedFiles) {
    throw new Error('Skill archive contains too many files');
  }

  let declaredExtractedBytes = entries.reduce(
    (total, entry) =>
      total +
      Number(
        (entry as typeof entry & { _data?: { uncompressedSize?: number } })._data
          ?.uncompressedSize ?? 0
      ),
    0
  );
  if (declaredExtractedBytes > maxExtractedBytes) {
    throw new Error('Skill archive expands beyond the import size limit');
  }

  let normalizedPaths = entries.map(entry =>
    normalizeArchivePath(
      (entry as typeof entry & { unsafeOriginalName?: string }).unsafeOriginalName ??
        entry.name
    )
  );
  let firstSegments = new Set(
    normalizedPaths.map(filePath => filePath.split('/')[0]).filter(Boolean)
  );
  let stripWrapper =
    firstSegments.size === 1 && normalizedPaths.every(filePath => filePath.includes('/'));
  let files: { path: string; content: Uint8Array }[] = [];
  let extractedBytes = 0;

  for (let index = 0; index < entries.length; index++) {
    let filePath = normalizedPaths[index]!;
    if (stripWrapper) filePath = filePath.split('/').slice(1).join('/');
    if (!filePath) continue;

    let content = await entries[index]!.async('uint8array');
    extractedBytes += content.byteLength;
    if (extractedBytes > maxExtractedBytes) {
      throw new Error('Skill archive expands beyond the import size limit');
    }
    files.push({ path: `/${filePath}`, content });
  }

  return files;
};

export let normalizeUploadedSkillFile = async (d: {
  format: SkillImportFileFormat;
  content: Uint8Array;
}) =>
  d.format === 'zip'
    ? await extractSkillArchive(d.content)
    : [{ path: '/SKILL.md', content: d.content }];
