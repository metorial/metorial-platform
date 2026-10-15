import { describe, expect, it } from 'bun:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

describe('generated resource indexes', () => {
  it('exports a raw usage resource and its nested timeline without shadowing either', async () => {
    let directory = await mkdtemp(path.join(tmpdir(), 'metorial-usage-generator-'));

    try {
      let output = path.join(directory, 'clients/metorial-dashboard/src/gen');
      let version = 'mt_2025_01_01_dashboard';
      let snapshotFile = path.join(directory, 'snapshot.json');
      let snapshot = {
        versions: { versions: [{ version, displayVersion: '2025-01-01', isCurrent: true }] },
        endpoints: {
          [version]: {
            controllers: [{ id: 'usage', name: 'Usage', description: 'Usage history' }],
            types: [
              {
                id: 'output',
                name: 'Usage',
                type: {
                  type: 'object',
                  optional: false,
                  nullable: false,
                  examples: [],
                  properties: {
                    object: { type: 'string', optional: false, nullable: false, examples: [] }
                  }
                }
              }
            ],
            endpoints: ['usage', 'usage.timeline'].map(method => ({
              method: 'get',
              name: method,
              description: method,
              allPaths: [
                {
                  path: `/sandbox/machines/:machineId/${method.replace('.', '/')}`,
                  sdkPath: `sandbox.machines.${method}`
                }
              ],
              outputId: 'output',
              controllerId: 'usage'
            }))
          }
        }
      };

      await writeFile(snapshotFile, JSON.stringify(snapshot));

      let generator = fileURLToPath(new URL('../../index.ts', import.meta.url));
      let generatorProcess = Bun.spawn(
        [
          Bun.which('bun')!,
          generator,
          'http://unreachable.invalid',
          output,
          'typescript',
          snapshotFile
        ],
        { stdout: 'pipe', stderr: 'pipe' }
      );
      let stderr = await new Response(generatorProcess.stderr).text();

      expect(await generatorProcess.exited, stderr).toBe(0);

      let index = await readFile(
        path.join(output, 'src', version, 'resources/sandbox/machines/index.ts'),
        'utf8'
      );

      expect(index).toContain("export * from './usage';");
      expect(index).toContain("export * from './usage/index';");
      expect(index.match(/export \* from '\.\/usage';/g)).toHaveLength(1);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
