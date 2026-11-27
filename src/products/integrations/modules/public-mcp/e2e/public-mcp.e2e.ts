import { firstPage, uniqueId, useOrganization } from '@metorial/e2e';
import { loadOrganizationFixture } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import {
  assertValidPublicMcpSlug,
  normalizePublicMcpSlug,
  publicMcpRouteService,
  publicMcpServerService
} from '../src';

describe('module-public-mcp', () => {
  let org = useOrganization();

  it('lists no public MCP servers for a fresh instance', async () => {
    let { instance } = await loadOrganizationFixture(org.ids);

    expect(
      await firstPage(await publicMcpServerService.listPublicMcpServers({ instance }))
    ).toEqual([]);
    expect(
      await firstPage(
        await publicMcpServerService.listPublicMcpServers({
          instance,
          status: ['active', 'disabled', 'archived']
        })
      )
    ).toEqual([]);

    await expect(
      publicMcpServerService.getPublicMcpServerById({
        instance,
        publicMcpServerId: uniqueId('missing-server')
      })
    ).rejects.toThrow(/could not be found/);
  });

  it('checks slug availability against the global registry', async () => {
    let slug = uniqueId('pmcp');

    expect(normalizePublicMcpSlug(`  ${slug.toUpperCase()} `)).toBe(slug);
    expect(await publicMcpServerService.isSlugAvailable({ slug })).toBe(true);
    expect(await publicMcpRouteService.resolveSlug({ slug })).toBeNull();

    await expect(publicMcpServerService.isSlugAvailable({ slug: 'mcp' })).rejects.toThrow(
      /reserved/
    );
    await expect(publicMcpServerService.isSlugAvailable({ slug: 'a--b' })).rejects.toThrow(
      /Slugs must be/
    );
    expect(() => assertValidPublicMcpSlug('ab')).toThrow(/Slugs must be/);
    expect(() => assertValidPublicMcpSlug(slug)).not.toThrow();
  });
});
