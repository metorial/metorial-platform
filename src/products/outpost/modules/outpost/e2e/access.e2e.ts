import { expectServiceError, firstPage, uniqueId, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture } from '@metorial/e2e/db';
import { instanceService } from '@metorial/module-organization';
import { describe, expect, it } from 'vitest';
import { outpostAccessService, outpostService } from '../src';
import {
  afterInvalidation,
  createConnectionVerifier,
  createOutpostWithCredential,
  createTestOutpostServer,
  decodeTokenPayload,
  MCP_CONNECTION_PROXY_SERVICE,
  OUTPOST_PROTOCOL_SERVICE,
  registerInstance,
  sendSigned,
  signedRequest
} from './_fixtures';

describe('module-outpost access grants', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let server = createTestOutpostServer();
  let verifier = createConnectionVerifier();

  let isGranted = (
    outpostId: string,
    instance: { oid: bigint; projectOid: bigint },
    service: 'mcp_connection_proxy' | 'outpost_registration_proxy' = 'mcp_connection_proxy'
  ) =>
    outpostAccessService.isServiceGrantedForInstance({
      outpostId,
      projectOid: instance.projectOid,
      instanceOid: instance.oid,
      service
    });

  it('grants services per instance and revokes them when access is replaced', async () => {
    let { fixture, outpost } = await createOutpostWithCredential(org.ids);
    let scope = { organization: fixture.organization, auditScope: fixture.auditScope };
    let secondInstance = await instanceService.createInstance({
      ...scope,
      project: fixture.project,
      input: { name: uniqueId('e2e-instance'), type: 'development' }
    });

    expect(await isGranted(outpost.id, fixture.instance)).toBe(false);

    let access = await outpostAccessService.setAccessForOrganization({
      ...scope,
      outpost,
      grants: [
        { instanceId: fixture.instance.id, services: ['mcp_connection_proxy'] },
        { instanceId: secondInstance.slug, services: ['outpost_registration_proxy'] }
      ]
    });
    expect(access.map(entry => [entry.instance.id, entry.services]).sort()).toEqual(
      [
        [fixture.instance.id, ['mcp_connection_proxy']],
        [secondInstance.id, ['outpost_registration_proxy']]
      ].sort()
    );

    await afterInvalidation(async () => {
      expect(await isGranted(outpost.id, fixture.instance)).toBe(true);
      expect(await isGranted(outpost.id, fixture.instance, 'outpost_registration_proxy')).toBe(
        false
      );
      expect(await isGranted(outpost.id, secondInstance)).toBe(false);
      expect(await isGranted(outpost.id, secondInstance, 'outpost_registration_proxy')).toBe(
        true
      );
    });

    let wrongProject = { oid: fixture.instance.oid, projectOid: fixture.project.oid + 1n };
    expect(await isGranted(outpost.id, wrongProject)).toBe(false);

    await outpostAccessService.setAccessForOrganization({
      ...scope,
      outpost,
      grants: [{ instanceId: secondInstance.id, services: ['mcp_connection_proxy'] }]
    });

    await afterInvalidation(async () => {
      expect(await isGranted(outpost.id, fixture.instance)).toBe(false);
      expect(await isGranted(outpost.id, secondInstance)).toBe(true);
      expect(await isGranted(outpost.id, secondInstance, 'outpost_registration_proxy')).toBe(
        false
      );
    });

    await outpostAccessService.setAccessForOrganization({ ...scope, outpost, grants: [] });
    await afterInvalidation(async () => {
      expect(await isGranted(outpost.id, secondInstance)).toBe(false);
    });
    expect(await firstPage(await outpostAccessService.listAccess({ outpost }))).toEqual([]);
  });

  it('only honours grants while the outpost is active', async () => {
    let { fixture, outpost } = await createOutpostWithCredential(org.ids);
    let scope = { organization: fixture.organization, auditScope: fixture.auditScope };

    await outpostAccessService.setAccessForOrganization({
      ...scope,
      outpost,
      grants: [{ instanceId: fixture.instance.id, services: ['mcp_connection_proxy'] }]
    });
    let expectGranted = (granted: boolean) =>
      afterInvalidation(async () => {
        expect(await isGranted(outpost.id, fixture.instance)).toBe(granted);
      });

    await expectGranted(true);

    let disabled = await outpostService.disableOutpost({ ...scope, outpost });
    await expectGranted(false);

    await outpostAccessService.setAccessForOrganization({
      ...scope,
      outpost: disabled,
      grants: [{ instanceId: fixture.instance.id, services: ['mcp_connection_proxy'] }]
    });
    await expectGranted(false);

    let enabled = await outpostService.enableOutpost({ ...scope, outpost: disabled });
    await expectGranted(true);

    let deleted = await outpostService.deleteOutpost({
      ...scope,
      outpost: await outpostService.disableOutpost({ ...scope, outpost: enabled })
    });
    await expectGranted(false);

    await expectServiceError(
      outpostAccessService.setAccessForOrganization({
        ...scope,
        outpost: deleted,
        grants: [{ instanceId: fixture.instance.id, services: ['mcp_connection_proxy'] }]
      }),
      'forbidden'
    );
  });

  it('rejects unknown services and instances of other organizations', async () => {
    let { fixture, outpost } = await createOutpostWithCredential(org.ids);
    let foreign = await loadOrganizationFixture(otherOrg.ids);
    let scope = {
      organization: fixture.organization,
      auditScope: fixture.auditScope,
      outpost
    };

    await expectServiceError(
      outpostAccessService.setAccessForOrganization({
        ...scope,
        grants: [{ instanceId: fixture.instance.id, services: ['shell_access' as any] }]
      }),
      'bad_request'
    );

    await expectServiceError(
      outpostAccessService.setAccessForOrganization({
        ...scope,
        grants: [{ instanceId: foreign.instance.id, services: ['mcp_connection_proxy'] }]
      }),
      'not_found'
    );

    await expectServiceError(
      outpostAccessService.setAccessForOrganization({
        ...scope,
        grants: [
          { instanceId: fixture.instance.id, services: ['mcp_connection_proxy'] },
          { instanceId: uniqueId('inst'), services: ['mcp_connection_proxy'] }
        ]
      }),
      'not_found'
    );

    expect(await db.outpostAccess.count({ where: { outpostOid: outpost.oid } })).toBe(0);
    expect(await isGranted(outpost.id, foreign.instance)).toBe(false);
  });

  it('replaces only the calling organization’s grants and filters the access list', async () => {
    let { fixture, outpost } = await createOutpostWithCredential(org.ids);
    let foreign = await loadOrganizationFixture(otherOrg.ids);

    await outpostAccessService.setAccessForOrganization({
      organization: fixture.organization,
      auditScope: fixture.auditScope,
      outpost,
      grants: [{ instanceId: fixture.instance.id, services: ['mcp_connection_proxy'] }]
    });
    await outpostAccessService.setAccessForOrganization({
      organization: foreign.organization,
      auditScope: foreign.auditScope,
      outpost,
      grants: [{ instanceId: foreign.instance.id, services: ['mcp_connection_proxy'] }]
    });

    let all = await firstPage(await outpostAccessService.listAccess({ outpost }));
    expect(all.map(entry => entry.instance.id).sort()).toEqual(
      [fixture.instance.id, foreign.instance.id].sort()
    );

    let byOrganization = await firstPage(
      await outpostAccessService.listAccess({
        outpost,
        filter: { organizationId: foreign.organization.id }
      })
    );
    expect(byOrganization.map(entry => entry.instance.id)).toEqual([foreign.instance.id]);

    let byInstance = await firstPage(
      await outpostAccessService.listAccess({
        outpost,
        filter: { instanceId: fixture.instance.id }
      })
    );
    expect(byInstance.map(entry => entry.organization.id)).toEqual([fixture.organization.id]);

    await outpostAccessService.setAccessForOrganization({
      organization: fixture.organization,
      auditScope: fixture.auditScope,
      outpost,
      grants: []
    });

    await afterInvalidation(async () => {
      expect(await isGranted(outpost.id, fixture.instance)).toBe(false);
      expect(await isGranted(outpost.id, foreign.instance)).toBe(true);
    });

    await expectServiceError(
      outpostAccessService.listAccess({
        outpost,
        filter: { organizationId: uniqueId('org') }
      }),
      'not_found'
    );
    await expectServiceError(
      outpostAccessService.listAccess({ outpost, filter: { instanceId: uniqueId('inst') } }),
      'not_found'
    );
  });

  it('reflects grants in registration decisions, instance tokens and the manifest', async () => {
    let { fixture, outpost, key } = await createOutpostWithCredential(org.ids);
    let scope = {
      organization: fixture.organization,
      auditScope: fixture.auditScope,
      outpost
    };

    let ungranted = await registerInstance(server, { credential: key });
    expect(ungranted.services).toEqual([{ id: MCP_CONNECTION_PROXY_SERVICE, granted: false }]);

    await outpostAccessService.setAccessForOrganization({
      ...scope,
      grants: [{ instanceId: fixture.instance.id, services: ['mcp_connection_proxy'] }]
    });

    let granted = await registerInstance(server, {
      credential: key,
      services: [
        { id: MCP_CONNECTION_PROXY_SERVICE, version: '1' },
        { id: 'outpost_registration_proxy' },
        { id: 'shell_access' }
      ]
    });
    expect(granted.services).toEqual([
      { id: MCP_CONNECTION_PROXY_SERVICE, granted: true },
      { id: 'outpost_registration_proxy', granted: false },
      { id: 'shell_access', granted: false }
    ]);
    expect(decodeTokenPayload(granted.instanceToken).d.services).toEqual([
      MCP_CONNECTION_PROXY_SERVICE
    ]);

    let rows = await db.outpostInstanceService.findMany({
      where: { instance: { identifier: granted.instanceId, outpostOid: outpost.oid } },
      orderBy: { service: 'asc' }
    });
    expect(rows.map(row => [row.service, row.granted])).toEqual([
      ['mcp_connection_proxy', true],
      ['outpost_registration_proxy', false]
    ]);

    let authenticated = await sendSigned(
      verifier,
      await signedRequest(granted, {
        url: 'https://connect.test/mcp',
        service: MCP_CONNECTION_PROXY_SERVICE
      })
    );
    expect(authenticated.body.grantedServices).toEqual([MCP_CONNECTION_PROXY_SERVICE]);

    let manifest = await sendSigned(
      server,
      await signedRequest(granted, {
        url: `http://outpost.test/outpost/manifest/${outpost.id}`,
        service: OUTPOST_PROTOCOL_SERVICE
      })
    );
    expect(manifest.body.access).toEqual([
      {
        compartment: {
          organizationId: fixture.organization.id,
          projectId: fixture.project.id,
          instanceId: fixture.instance.id
        },
        services: [{ id: 'mcp_connection_proxy' }]
      }
    ]);

    await outpostAccessService.setAccessForOrganization({ ...scope, grants: [] });

    await afterInvalidation(async () => {
      let manifestAfterRevoke = await sendSigned(
        server,
        await signedRequest(granted, {
          url: `http://outpost.test/outpost/manifest/${outpost.id}`,
          service: OUTPOST_PROTOCOL_SERVICE
        })
      );
      expect(manifestAfterRevoke.body.access).toEqual([]);
      expect(await isGranted(outpost.id, fixture.instance)).toBe(false);
    });

    let reregistered = await registerInstance(server, {
      credential: key,
      instanceId: granted.instanceId,
      instanceKeys: granted.instanceKeys
    });
    expect(reregistered.services).toEqual([
      { id: MCP_CONNECTION_PROXY_SERVICE, granted: false }
    ]);
    expect(decodeTokenPayload(reregistered.instanceToken).d.services).toEqual([]);

    let reconciled = await db.outpostInstanceService.findMany({
      where: { instance: { identifier: granted.instanceId, outpostOid: outpost.oid } }
    });
    expect(reconciled.map(row => [row.service, row.granted])).toEqual([
      ['mcp_connection_proxy', false]
    ]);
  });
});
