import { describe, expect, it } from 'vitest';
import { isBufferableTextFile, maxBufferedFileSize } from './fileContentPolicy';

describe('buffered file content policy', () => {
  it('accepts common text extensions case-insensitively below one MiB', () => {
    expect(isBufferableTextFile({ fileName: 'server.TS', size: 1 })).toBe(true);
    expect(
      isBufferableTextFile({ fileName: 'configuration.YAML', size: maxBufferedFileSize - 1 })
    ).toBe(true);
  });

  it('rejects files at the size boundary and unknown extensions', () => {
    expect(isBufferableTextFile({ fileName: 'server.ts', size: maxBufferedFileSize })).toBe(
      false
    );
    expect(isBufferableTextFile({ fileName: 'archive.zip', size: 1 })).toBe(false);
  });
});
