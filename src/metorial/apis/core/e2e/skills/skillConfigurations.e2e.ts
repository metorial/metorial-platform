import {
  expectError,
  expectOk,
  expectPresented,
  listAll,
  useMember,
  useOrganization
} from '@metorial/e2e';
import { describe, expect, it } from 'vitest';
import {
  badRequest,
  expectResponses,
  expectRoutesAuth,
  forbidden,
  getRoute,
  ids,
  invalid,
  listAuth,
  memberApi,
  notFound,
  resourceAuth,
  skillClients
} from './_shared';

describe('api-core skill configurations', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let member = useMember(org);

  it('creates, gets, lists, updates and deletes a configuration', async () => {
    let api = org.clients.instance;

    let created = expectOk(
      await api.post('/skills/configurations', {
        allow_scripts: false,
        allowed_file_extensions: ['MD', 'txt', '.json'],
        allow_non_standard_directories: false
      })
    );
    expectPresented(created, 'skill.configuration');
    expect(created).toMatchObject({
      is_default: false,
      allow_scripts: false,
      allowed_file_extensions: ['.md', '.txt', '.json'],
      allow_non_standard_directories: false,
      deleted_at: null
    });

    let fetched = expectOk(await api.get(`/skills/configurations/${created.id}`));
    expect(fetched).toEqual(created);

    let updated = expectOk(
      await api.patch(`/skills/configurations/${created.id}`, {
        allow_scripts: true,
        allowed_file_extensions: null
      })
    );
    expect(updated).toMatchObject({
      id: created.id,
      allow_scripts: true,
      allowed_file_extensions: [],
      allow_non_standard_directories: false
    });

    expect(ids(await listAll(api, '/skills/configurations'))).toContain(created.id);

    let deleted = expectOk(await api.delete(`/skills/configurations/${created.id}`));
    expectPresented(deleted, 'skill.configuration');
    expect(deleted.deleted_at).not.toBeNull();

    expectError(await api.get(`/skills/configurations/${created.id}`), 404);
    expect(ids(await listAll(api, '/skills/configurations'))).not.toContain(created.id);
  });

  it('creates the default configuration on first use and refuses to delete it', async () => {
    let api = org.clients.instance;

    let first = expectOk(await api.get('/skills/configurations/default'));
    expectPresented(first, 'skill.configuration');
    expect(first).toMatchObject({
      is_default: true,
      allow_scripts: true,
      allowed_file_extensions: [],
      allow_non_standard_directories: true
    });

    let again = expectOk(await api.get('/skills/configurations/default'));
    expect(again.id).toBe(first.id);

    let byId = expectOk(await api.get(`/skills/configurations/${first.id}`));
    expect(byId).toMatchObject({ id: first.id, is_default: true });

    let updated = expectOk(
      await api.patch('/skills/configurations/default', {
        allow_non_standard_directories: false
      })
    );
    expect(updated).toMatchObject({ id: first.id, allow_non_standard_directories: false });

    expectError(await api.delete('/skills/configurations/default'), 403, 'forbidden');
    expectError(await api.delete(`/skills/configurations/${first.id}`), 403, 'forbidden');

    let otherDefault = expectOk(
      await otherOrg.clients.instance.get('/skills/configurations/default')
    );
    expect(otherDefault.id).not.toBe(first.id);
    expect(otherDefault.allow_non_standard_directories).toBe(true);
  });

  it('serves configurations to every instance credential and hides them from other organizations', async () => {
    let created = expectOk(await org.clients.instance.post('/skills/configurations', {}));
    let clients = skillClients(org, otherOrg, member);

    await expectRoutesAuth(org, clients, [
      getRoute('/skills/configurations', listAuth),
      getRoute(`/skills/configurations/${created.id}`, resourceAuth),
      getRoute('/skills/configurations/default', listAuth),
      {
        label: 'PATCH /skills/configurations/:id',
        call: (client, route) =>
          client.patch(route(`/skills/configurations/${created.id}`), { allow_scripts: true }),
        expected: resourceAuth
      }
    ]);

    let otherDefault = expectOk(
      await otherOrg.clients.instance.get('/skills/configurations/default')
    );
    expectError(
      await org.clients.instance.get(`/skills/configurations/${otherDefault.id}`),
      404
    );
    expectError(
      await org.clients.instance.delete(`/skills/configurations/${otherDefault.id}`),
      404
    );

    let memberCreated = expectOk(
      await memberApi(org, member).post('/skills/configurations', {})
    );
    expect(memberCreated.is_default).toBe(false);
  });

  it('rejects invalid configuration bodies', async () => {
    let api = org.clients.instance;
    let created = expectOk(await api.post('/skills/configurations', {}));

    await expectResponses([
      invalid('string allow_scripts', () =>
        api.post('/skills/configurations', { allow_scripts: 'yes' })
      ),
      invalid('non-array allowed_file_extensions', () =>
        api.post('/skills/configurations', { allowed_file_extensions: '.md' })
      ),
      invalid('numeric allowed file extension', () =>
        api.post('/skills/configurations', { allowed_file_extensions: [1] })
      ),
      invalid('update with string allow_non_standard_directories', () =>
        api.patch(`/skills/configurations/${created.id}`, {
          allow_non_standard_directories: 'no'
        })
      ),
      badRequest('allowed extensions without .md', () =>
        api.post('/skills/configurations', { allowed_file_extensions: ['.txt'] })
      ),
      badRequest('update without any field', () =>
        api.patch(`/skills/configurations/${created.id}`, {})
      ),
      notFound('unknown configuration', () => api.get('/skills/configurations/skcfg_missing')),
      forbidden('delete the default', () => api.delete('/skills/configurations/default'))
    ]);
  });
});
