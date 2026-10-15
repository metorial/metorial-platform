import { unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { packSandboxDockerfile } from './archive';

describe('packSandboxDockerfile', () => {
  it('zips a standalone Dockerfile at the configured path without changing its contents', async () => {
    let text = 'FROM ubuntu:24.04\nRUN echo héllo\n';
    let file = await packSandboxDockerfile(text, './build/Dockerfile');
    let entries = unzipSync(new Uint8Array(await file.arrayBuffer()));

    expect(file.name).toBe('build-context.zip');
    expect(file.type).toBe('application/zip');
    expect(Object.keys(entries)).toEqual(['build/Dockerfile']);
    expect(new TextDecoder().decode(entries['build/Dockerfile'])).toBe(text);
  });

  it('rejects empty Dockerfiles', async () => {
    await expect(packSandboxDockerfile('  ', 'Dockerfile')).rejects.toThrow(
      'must not be empty'
    );
  });

  it('rejects paths escaping the archive', async () => {
    await expect(packSandboxDockerfile('FROM ubuntu:24.04', '../Dockerfile')).rejects.toThrow(
      'relative path'
    );
    await expect(packSandboxDockerfile('FROM ubuntu:24.04', '/Dockerfile')).rejects.toThrow(
      'relative path'
    );
  });
});
