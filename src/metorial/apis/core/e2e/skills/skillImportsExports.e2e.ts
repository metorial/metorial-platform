import { expectOk, expectPresented, listAll, useMember, useOrganization } from '@metorial/e2e';
import { loadOrganizationFixture } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import {
  badRequest,
  expectResponses,
  expectRoutesAuth,
  getRoute,
  ids,
  invalid,
  listAuth,
  notFound,
  resourceAuth,
  seedMarketplace,
  seedPlugin,
  skillClients
} from './_shared';

describe('api-core skill imports and exports', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let member = useMember(org);

  describe('imports', () => {
    it('serves imports to every instance credential', async () => {
      await expectRoutesAuth(org, skillClients(org, otherOrg, member), [
        getRoute('/skill-imports', listAuth),
        {
          label: 'POST /skill-imports',
          call: (client, route) =>
            client.post(route('/skill-imports'), {
              source: { type: 'file', file_id: 'fil_missing' }
            }),
          expected: { none: 401, otherSession: 404, otherManagement: 404 }
        }
      ]);
    });

    it('rejects invalid import sources and unknown files', async () => {
      let api = org.clients.instance;

      await expectResponses([
        invalid('import without a source', () => api.post('/skill-imports', {})),
        invalid('import with an unknown source type', () =>
          api.post('/skill-imports', { source: { type: 'ftp', url: 'ftp://example.com' } })
        ),
        invalid('public import with an invalid url', () =>
          api.post('/skill-imports', {
            source: { type: 'public', repository_url: 'not a url' }
          })
        ),
        invalid('origin import without a repository', () =>
          api.post('/skill-imports', { source: { type: 'origin' } })
        ),
        invalid('file import without a file', () =>
          api.post('/skill-imports', { source: { type: 'file' } })
        ),
        invalid('list with an unknown status', () =>
          api.get('/skill-imports', { query: { status: 'queued' } })
        ),
        notFound('file import with an unknown file', () =>
          api.post('/skill-imports', { source: { type: 'file', file_id: 'fil_missing' } })
        ),
        notFound('unknown import', () => api.get('/skill-imports/skimp_missing'))
      ]);

      expect(await listAll(api, '/skill-imports')).toEqual([]);
    });
  });

  describe('exports', () => {
    it('exports a plugin and a marketplace and lists them by target', async () => {
      let api = org.clients.instance;
      let fixture = await loadOrganizationFixture(org.ids);
      let plugin = await seedPlugin(fixture);
      let marketplace = await seedMarketplace(fixture);

      let pluginExport = expectOk(
        await api.post('/skill-exports', { target: 'plugin', skill_plugin_id: plugin.id })
      );
      expectPresented(pluginExport, 'skill.export');
      expect(pluginExport).toMatchObject({ target: 'plugin' });
      expect(['pending', 'completed', 'failed']).toContain(pluginExport.status);

      let marketplaceExport = expectOk(
        await api.post('/skill-exports', {
          target: 'marketplace',
          skill_marketplace_id: marketplace.id
        })
      );
      expect(marketplaceExport.target).toBe('marketplace');

      let fetched = expectOk(await api.get(`/skill-exports/${pluginExport.id}`));
      expectPresented(fetched, 'skill.export');
      expect(fetched).toMatchObject({ id: pluginExport.id, target: 'plugin' });

      let plugins = await listAll(api, '/skill-exports', { query: { target: 'plugin' } });
      expect(ids(plugins)).toContain(pluginExport.id);
      expect(ids(plugins)).not.toContain(marketplaceExport.id);

      let byId = await listAll(api, '/skill-exports', { query: { id: marketplaceExport.id } });
      expect(ids(byId)).toEqual([marketplaceExport.id]);

      await expectRoutesAuth(org, skillClients(org, otherOrg, member), [
        getRoute('/skill-exports', listAuth),
        getRoute(`/skill-exports/${pluginExport.id}`, resourceAuth)
      ]);

      let otherList = await listAll(otherOrg.clients.instance, '/skill-exports');
      expect(ids(otherList)).not.toContain(pluginExport.id);
    });

    it('rejects invalid exports and targets outside the instance', async () => {
      let api = org.clients.instance;
      let foreign = await loadOrganizationFixture(otherOrg.ids);
      let foreignPlugin = await seedPlugin(foreign);
      let foreignMarketplace = await seedMarketplace(foreign);
      let before = ids(await listAll(api, '/skill-exports'));

      await expectResponses([
        invalid('export without a target', () => api.post('/skill-exports', {})),
        invalid('export with an unknown target', () =>
          api.post('/skill-exports', { target: 'organization' })
        ),
        invalid('export with a numeric plugin id', () =>
          api.post('/skill-exports', { target: 'plugin', skill_plugin_id: 1 })
        ),
        invalid('list with an unknown status', () =>
          api.get('/skill-exports', { query: { status: 'queued' } })
        ),
        badRequest('skill export without a skill id', () =>
          api.post('/skill-exports', { target: 'skill' })
        ),
        badRequest('plugin export with only a marketplace id', () =>
          api.post('/skill-exports', {
            target: 'plugin',
            skill_marketplace_id: foreignMarketplace.id
          })
        ),
        notFound('export another organization plugin', () =>
          api.post('/skill-exports', { target: 'plugin', skill_plugin_id: foreignPlugin.id })
        ),
        notFound('export another organization marketplace', () =>
          api.post('/skill-exports', {
            target: 'marketplace',
            skill_marketplace_id: foreignMarketplace.id
          })
        ),
        notFound('unknown export', () => api.get('/skill-exports/skexp_missing'))
      ]);

      expect(ids(await listAll(api, '/skill-exports'))).toEqual(before);
      expect(await listAll(otherOrg.clients.instance, '/skill-exports')).toEqual([]);
    });
  });
});
