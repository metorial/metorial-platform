import { describe, expect, it } from 'bun:test';
import { existsSync } from 'fs';
import { join } from 'path';
import { resolveBuild } from '../compose/builds';
import { resolveGraph } from '../graph/resolver';
import { getRegistry, resolveService } from '../registry';
import { createWorkspaceSession, destroyWorkspaceSession } from './session';

describe('staged build context', () => {
  it('points docker builds at .control/temp-src', async () => {
    let session = await createWorkspaceSession({ entrypoint: '.', verbose: false });

    try {
      let registry = getRegistry({ cwd: process.cwd(), entrypoint: '.', session });
      let service = resolveService(registry, 'subspace-public');
      let graph = resolveGraph({
        entrypoint: registry.controlRoot,
        targetDir: service.dir,
        registry
      });
      let build = resolveBuild(graph, { role: 'test-runner' });

      expect(build.context).toContain(join('.control', 'temp-src', session.id));
      expect(existsSync(build.context)).toBe(true);
    } finally {
      await destroyWorkspaceSession();
    }
  });
});
