import { describe, expect, it } from 'vitest';
import { apiServer } from '../../src/apiServer';

describe('api core e2e smoke', () => {
  it('responds to the shared rest ping route', async () => {
    let response = await apiServer.fetch(new Request('http://localhost/ping'));

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('OK');
  });

  it('exposes api versions through the shared rest backbone', async () => {
    let response = await apiServer.fetch(
      new Request('http://localhost/metorial/introspect/versions')
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      versions: expect.arrayContaining([
        expect.objectContaining({ version: 'mt_2025_01_01_dashboard' }),
        expect.objectContaining({ version: 'mt_2026_01_01_magnetar' })
      ])
    });
  });
});
