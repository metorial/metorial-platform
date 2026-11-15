import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { delay } from '../src/process';

test('serves the workbench on deep links while keeping unknown API routes as 404s', async () => {
  let directory = mkdtempSync(join(tmpdir(), 'control-ui-server-'));
  let reservation = Bun.serve({ port: 0, fetch: () => new Response() });
  let port = reservation.port!;
  reservation.stop(true);

  let process = Bun.spawn(
    [Bun.which('bun')!, join(import.meta.dir, '../src/main.ts'), 'daemon', 'run'],
    {
      env: {
        ...Bun.env,
        CONTROL_HOME: directory,
        CONTROL_UI_PORT: String(port),
        CONTROL_CACHE: '0'
      },
      stdout: 'ignore',
      stderr: 'pipe'
    }
  );
  let origin = `http://127.0.0.1:${port}`;

  try {
    let deadline = Date.now() + 8000;
    let ready = false;

    while (Date.now() < deadline && !ready) {
      ready = await fetch(`${origin}/api/ping`, { signal: AbortSignal.timeout(200) })
        .then(response => response.ok)
        .catch(() => false);
      if (!ready) await delay(50);
    }

    expect(ready).toBe(true);

    for (let path of [
      '/',
      '/index.html',
      '/w/stack-on-prem',
      '/w/feature%2Fauth/logs/core-api?expanded=1',
      '/w/stack-on-prem/terminal/core-api'
    ]) {
      let response = await fetch(origin + path);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/html');
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(await response.text()).toContain('id="c-workbench"');
    }

    let missing = await fetch(`${origin}/api/does-not-exist`);

    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: 'not found' });
  } finally {
    process.kill();
    await process.exited;
    rmSync(directory, { recursive: true, force: true });
  }
}, 12000);
