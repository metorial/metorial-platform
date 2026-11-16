import { uniqueId } from '@lowerdeck/testing-tools';
import { describe, expect, it } from 'vitest';
import { createTenant, expectRpcError, publicApi, registryClient } from './helpers';

describe('workspace E2E', () => {
  it('creates, gets, updates and lists workspaces', async () => {
    let tenant = await createTenant();
    let identifier = uniqueId('ws');

    let workspace = await registryClient.workspace.create({
      tenantId: tenant.id,
      identifier,
      name: 'Team'
    });
    expect(workspace).toMatchObject({ object: 'workspace', identifier, name: 'Team' });

    let updated = await registryClient.workspace.update({
      tenantId: tenant.id,
      workspaceId: workspace.id,
      name: 'Team Renamed'
    });
    expect(updated.name).toBe('Team Renamed');

    let fetched = await registryClient.workspace.get({
      tenantId: tenant.id,
      workspaceId: workspace.id
    });
    expect(fetched.name).toBe('Team Renamed');

    let listed = await registryClient.workspace.list({ tenantId: tenant.id });
    expect(listed.items.map(w => w.id)).toEqual([workspace.id]);
  });

  it('rejects duplicate identifiers', async () => {
    let tenant = await createTenant();
    let identifier = uniqueId('ws');

    await registryClient.workspace.create({ tenantId: tenant.id, identifier, name: 'A' });

    await expectRpcError(
      registryClient.workspace.create({ tenantId: tenant.id, identifier, name: 'B' }),
      'conflict'
    );
  });

  it('does not expose workspaces of another tenant', async () => {
    let owner = await createTenant();
    let outsider = await createTenant();
    let workspace = await registryClient.workspace.create({
      tenantId: owner.id,
      identifier: uniqueId('ws'),
      name: 'Private'
    });

    await expectRpcError(
      registryClient.workspace.get({ tenantId: outsider.id, workspaceId: workspace.id }),
      'not_found'
    );
    await expectRpcError(
      registryClient.workspace.update({
        tenantId: outsider.id,
        workspaceId: workspace.id,
        name: 'Hijacked'
      }),
      'not_found'
    );
  });

  it('is readable through the public API', async () => {
    let tenant = await createTenant();
    let workspace = await registryClient.workspace.create({
      tenantId: tenant.id,
      identifier: uniqueId('ws'),
      name: 'Public Team'
    });

    let response = await publicApi().get(`/workspaces/${workspace.id}`);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: workspace.id, name: 'Public Team' });

    let byIdentifier = await publicApi().get(`/workspaces/${workspace.identifier}`);
    expect(byIdentifier.body.id).toBe(workspace.id);

    let missing = await publicApi().get('/workspaces/ws_doesnotexist');
    expect(missing.status).toBe(404);
  });
});
