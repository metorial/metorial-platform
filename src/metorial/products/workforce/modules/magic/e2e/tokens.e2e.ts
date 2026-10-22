import { expectServiceError, firstPage, uniqueId, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import { consumerMagicMcpReadRoles } from '@metorial/module-access';
import { describe, expect, it } from 'vitest';
import { magicMcpEndpointService, magicMcpGroupService, magicMcpTokenService } from '../src';
import {
  archiveServer,
  createAccessTag,
  createEndpoint,
  createGroup,
  createServer,
  createToken,
  grantAccessTag,
  ids
} from './_fixtures';

type Token = Awaited<ReturnType<typeof createToken>>;
type AccessTarget = Omit<
  Parameters<typeof magicMcpTokenService.checkMagicMcpTokenAccess>[0],
  'token'
>;

let hasAccess = (token: Token, target: AccessTarget) =>
  magicMcpTokenService.checkMagicMcpTokenAccess({ token, ...target });

let reload = async (fixture: OrganizationFixture, token: { id: string }) =>
  await magicMcpTokenService.getMagicMcpTokenById({
    instance: fixture.instance,
    magicMcpTokenId: token.id
  });

let listTokenIds = async (
  fixture: OrganizationFixture,
  filters: Omit<Parameters<typeof magicMcpTokenService.listMagicMcpTokens>[0], 'instance'>
) =>
  ids(
    await firstPage(
      await magicMcpTokenService.listMagicMcpTokens({ instance: fixture.instance, ...filters })
    )
  );

describe('module-magic tokens', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  it('scopes token access to the linked server or endpoint', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let serverA = await createServer(fixture);
    let serverB = await createServer(fixture);
    let endpointA = await createEndpoint(fixture, [serverA]);
    let endpointB = await createEndpoint(fixture, [serverB]);

    let unlinked = await createToken(fixture);
    expect(await hasAccess(unlinked, { server: serverA })).toBe(true);
    expect(await hasAccess(unlinked, { endpoint: endpointB })).toBe(true);
    expect(await hasAccess(unlinked, { server: { ...serverA, status: 'archived' } })).toBe(
      false
    );

    let serverToken = await createToken(fixture, { magicMcpServer: serverA });
    expect(await hasAccess(serverToken, { server: serverA })).toBe(true);
    expect(await hasAccess(serverToken, { server: serverB })).toBe(false);
    expect(await hasAccess(serverToken, { endpoint: endpointA })).toBe(false);

    let endpointToken = await createToken(fixture, { magicMcpEndpoint: endpointA });
    expect(await hasAccess(endpointToken, { endpoint: endpointA })).toBe(true);
    expect(await hasAccess(endpointToken, { endpoint: endpointB })).toBe(false);
    expect(await hasAccess(endpointToken, { server: serverA })).toBe(false);
    expect(
      await hasAccess(endpointToken, { endpoint: { ...endpointA, status: 'archived' } })
    ).toBe(false);

    await expect(hasAccess(unlinked, {})).rejects.toThrow('requires a server or endpoint');
  });

  it('limits group-locked tokens to the servers of their groups', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let inGroup = await createServer(fixture);
    let outside = await createServer(fixture);
    let group = await createGroup(fixture, [inGroup]);
    let coveredEndpoint = await createEndpoint(fixture, [inGroup]);
    let partialEndpoint = await createEndpoint(fixture, [inGroup, outside]);

    let token = await createToken(fixture, { groups: [group] });
    expect(token.isGroupLocked).toBe(true);
    expect(await hasAccess(token, { server: inGroup })).toBe(true);
    expect(await hasAccess(token, { server: outside })).toBe(false);
    expect(await hasAccess(token, { endpoint: coveredEndpoint })).toBe(true);
    expect(await hasAccess(token, { endpoint: partialEndpoint })).toBe(false);

    await magicMcpGroupService.removeServersFromGroup({
      group,
      serverIds: [inGroup.id],
      auditScope: fixture.auditScope
    });
    expect(await hasAccess(await reload(fixture, token), { server: inGroup })).toBe(false);
  });

  it('allows consumer tokens only on targets that share their access tag', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let granted = await createServer(fixture);
    let hidden = await createServer(fixture);
    let grantedEndpoint = await createEndpoint(fixture, [granted]);
    let hiddenEndpoint = await createEndpoint(fixture, [granted]);
    let accessTag = await createAccessTag(fixture);
    let token = await createToken(fixture);

    for (let target of [
      { magicMcpTokenOid: token.oid },
      { magicMcpServerOid: granted.oid },
      { magicMcpEndpointOid: grantedEndpoint.oid }
    ]) {
      await grantAccessTag(fixture, {
        accessTagOid: accessTag.oid,
        roles: consumerMagicMcpReadRoles,
        target
      });
    }

    expect(await hasAccess(token, { server: granted })).toBe(true);
    expect(await hasAccess(token, { server: hidden })).toBe(false);
    expect(await hasAccess(token, { endpoint: grantedEndpoint })).toBe(true);
    expect(await hasAccess(token, { endpoint: hiddenEndpoint })).toBe(false);

    expect(await listTokenIds(fixture, { status: ['active', 'deleted'] })).not.toContain(
      token.id
    );
    expect(await listTokenIds(fixture, { accessTags: accessTag.oid })).toEqual([token.id]);
  });

  it('refuses tokens linked to both targets or to inactive resources', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let server = await createServer(fixture);
    let endpoint = await createEndpoint(fixture, [server]);
    let archived = await archiveServer(fixture, await createServer(fixture));
    let archivedEndpoint = await magicMcpEndpointService.archiveMagicMcpEndpoint({
      endpoint: await createEndpoint(fixture, []),
      auditScope: fixture.auditScope
    });
    let deletedGroup = await magicMcpGroupService.deleteMagicMcpGroup({
      group: await createGroup(fixture),
      auditScope: fixture.auditScope
    });
    let name = uniqueId('Rejected Token');

    for (let input of [
      { name, magicMcpServer: server, magicMcpEndpoint: endpoint },
      { name, magicMcpServer: archived },
      { name, magicMcpEndpoint: archivedEndpoint },
      { name, groups: [deletedGroup] }
    ]) {
      await expectServiceError(createToken(fixture, input), 'precondition_failed');
    }
    expect(await db.magicMcpToken.count({ where: { name } })).toBe(0);
  });

  it('rejects secrets of deleted, expired, orphaned and foreign tokens', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let bySecret = (secret: string, instance = fixture.instance) =>
      magicMcpTokenService.getMagicMcpTokenBySecret({ secret, instance });

    let deleted = await magicMcpTokenService.deleteMagicMcpToken({
      token: await createToken(fixture),
      auditScope: fixture.auditScope
    });
    expect(
      await magicMcpTokenService.getMagicMcpTokenBySecretSafe({
        secret: deleted.secret,
        instance: fixture.instance
      })
    ).toBeNull();
    await expectServiceError(bySecret(deleted.secret), 'unauthorized');

    let expired = await createToken(fixture, { expiresAt: new Date(Date.now() - 60_000) });
    let expiredError = await expectServiceError(bySecret(expired.secret), 'unauthorized');
    expect(expiredError.message).toContain('expired');

    let server = await createServer(fixture);
    let serverToken = await createToken(fixture, { magicMcpServer: server });
    await archiveServer(fixture, server);
    await expectServiceError(bySecret(serverToken.secret), 'unauthorized');
    await expectServiceError(
      magicMcpTokenService.rotateMagicMcpTokenSecret({
        token: await reload(fixture, serverToken),
        auditScope: fixture.auditScope
      }),
      'precondition_failed'
    );

    let endpoint = await createEndpoint(fixture, []);
    let endpointToken = await createToken(fixture, { magicMcpEndpoint: endpoint });
    await magicMcpEndpointService.archiveMagicMcpEndpoint({
      endpoint,
      auditScope: fixture.auditScope
    });
    await expectServiceError(bySecret(endpointToken.secret), 'unauthorized');

    let active = await createToken(fixture);
    expect((await bySecret(active.secret)).id).toBe(active.id);
    await expectServiceError(bySecret(active.secret, other.instance), 'unauthorized');
  });

  it('rotates with a new expiry and refuses changes to deleted tokens', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let token = await createToken(fixture);
    let expiresAt = new Date(Date.now() + 3_600_000);

    let rotated = await magicMcpTokenService.rotateMagicMcpTokenSecret({
      token,
      expiresAt,
      auditScope: fixture.auditScope
    });
    expect(rotated.secret).not.toBe(token.secret);
    expect(rotated.expiresAt?.getTime()).toBe(expiresAt.getTime());

    let deleted = await magicMcpTokenService.deleteMagicMcpToken({
      token: rotated,
      auditScope: fixture.auditScope
    });
    await expectServiceError(
      magicMcpTokenService.rotateMagicMcpTokenSecret({
        token: deleted,
        auditScope: fixture.auditScope
      }),
      'precondition_failed'
    );
    await expectServiceError(
      magicMcpTokenService.updateMagicMcpToken({
        token: deleted,
        auditScope: fixture.auditScope,
        input: { name: 'Too late' }
      }),
      'precondition_failed'
    );
  });

  it('adds and removes groups only on tokens without a linked target', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let group = await createGroup(fixture);
    let foreignGroup = await createGroup(other);
    let deletedGroup = await magicMcpGroupService.deleteMagicMcpGroup({
      group: await createGroup(fixture),
      auditScope: fixture.auditScope
    });
    let serverToken = await createToken(fixture, {
      magicMcpServer: await createServer(fixture)
    });
    let token = await createToken(fixture);

    let groupChange = {
      token: serverToken,
      groupIds: [group.id],
      auditScope: fixture.auditScope
    };
    await expectServiceError(
      magicMcpTokenService.addGroupsToToken(groupChange),
      'precondition_failed'
    );
    await expectServiceError(
      magicMcpTokenService.removeGroupsFromToken(groupChange),
      'precondition_failed'
    );

    for (let groupId of [uniqueId('mmg'), foreignGroup.id]) {
      await expectServiceError(
        magicMcpTokenService.addGroupsToToken({
          token,
          groupIds: [groupId],
          auditScope: fixture.auditScope
        }),
        'not_found'
      );
    }
    await expectServiceError(
      magicMcpTokenService.addGroupsToToken({
        token,
        groupIds: [deletedGroup.id],
        auditScope: fixture.auditScope
      }),
      'precondition_failed'
    );

    let locked = await magicMcpTokenService.addGroupsToToken({
      token,
      groupIds: [group.id, group.id],
      auditScope: fixture.auditScope
    });
    expect(locked.isGroupLocked).toBe(true);
    expect(locked.groups.map(link => link.magicMcpGroup.id)).toEqual([group.id]);

    let unlocked = await magicMcpTokenService.removeGroupsFromToken({
      token,
      groupIds: [group.id],
      auditScope: fixture.auditScope
    });
    expect(unlocked.isGroupLocked).toBe(false);
    expect(unlocked.groups).toEqual([]);
  });

  it('lists tokens by the server, endpoint and group they can reach', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let server = await createServer(fixture);
    let otherServer = await createServer(fixture);
    let group = await createGroup(fixture, [server]);
    let endpoint = await createEndpoint(fixture, [server]);

    let serverToken = await createToken(fixture, { magicMcpServer: server });
    let otherServerToken = await createToken(fixture, { magicMcpServer: otherServer });
    let unlinked = await createToken(fixture);
    let groupToken = await createToken(fixture, { groups: [group] });
    let endpointToken = await createToken(fixture, { magicMcpEndpoint: endpoint });

    let byServer = await listTokenIds(fixture, { serverIds: [server.id] });
    expect(byServer).toEqual(
      expect.arrayContaining([serverToken.id, unlinked.id, groupToken.id])
    );
    expect(byServer).not.toContain(otherServerToken.id);
    expect(byServer).not.toContain(endpointToken.id);

    expect(await listTokenIds(fixture, { endpointIds: [endpoint.id] })).toEqual([
      endpointToken.id
    ]);
    expect(await listTokenIds(fixture, { groupIds: [group.id] })).toEqual([groupToken.id]);

    await magicMcpTokenService.deleteMagicMcpToken({
      token: serverToken,
      auditScope: fixture.auditScope
    });
    expect(
      await listTokenIds(fixture, { serverIds: [server.id], status: ['deleted'] })
    ).toContain(serverToken.id);
    expect(
      await listTokenIds(fixture, { serverIds: [server.id], status: ['active'] })
    ).not.toContain(serverToken.id);
  });

  it('records one token use per target, client and hour', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let server = await createServer(fixture);
    let endpoint = await createEndpoint(fixture, [server]);
    let token = await createToken(fixture);
    let use = (target: { server?: typeof server; endpoint?: typeof endpoint }, ua = 'agent') =>
      magicMcpTokenService.recordMagicMcpTokenUse({ token, ...target, ip: '127.0.0.1', ua });

    await use({ server });
    await use({ server });
    await use({ server }, 'other-agent');
    await use({ endpoint });

    let uses = await db.magicMcpTokenUse.findMany({ where: { magicMcpTokenOid: token.oid } });
    expect(uses).toHaveLength(3);
    expect(uses.filter(item => item.magicMcpServerOid === server.oid)).toHaveLength(2);
    expect(uses.filter(item => item.magicMcpEndpointOid === endpoint.oid)).toHaveLength(1);

    await expect(use({ server, endpoint })).rejects.toThrow('exactly one server or endpoint');
  });

  it('hides tokens from another organization', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let token = await createToken(fixture);

    await expectServiceError(reload(other, token), 'not_found');
    await expectServiceError(
      magicMcpTokenService.checkWriteAccess({ token, instance: other.instance }),
      'not_found'
    );
    expect(await listTokenIds(other, { status: ['active', 'deleted'] })).not.toContain(
      token.id
    );
  });
});

describe('module-magic groups', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  it('links only active servers of its own instance', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let server = await createServer(fixture);
    let archived = await archiveServer(fixture, await createServer(fixture));
    let foreign = await createServer(other);
    let group = await createGroup(fixture);
    let link = (serverIds: string[]) =>
      magicMcpGroupService.addServersToGroup({
        group,
        serverIds,
        auditScope: fixture.auditScope
      });

    await expectServiceError(link([server.id, uniqueId('mms')]), 'not_found');
    await expectServiceError(link([server.id, foreign.id]), 'not_found');
    await expectServiceError(link([archived.id]), 'precondition_failed');
    expect(
      await db.magicMcpGroupServer.count({ where: { magicMcpGroupOid: group.oid } })
    ).toBe(0);

    await link([server.id, server.id]);
    expect(
      await db.magicMcpGroupServer.count({ where: { magicMcpGroupOid: group.oid } })
    ).toBe(1);
  });

  it('resolves token groups only when all of them are active and local', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let group = await createGroup(fixture);
    let foreignGroup = await createGroup(other);
    let deletedGroup = await magicMcpGroupService.deleteMagicMcpGroup({
      group: await createGroup(fixture),
      auditScope: fixture.auditScope
    });
    let find = (groupIds: string[]) =>
      magicMcpGroupService.findManyGroupsById({ groupIds, instance: fixture.instance });

    expect(await find([])).toEqual([]);
    expect(ids(await find([group.id, group.id]))).toEqual([group.id]);
    await expectServiceError(find([group.id, uniqueId('mmg')]), 'not_found');
    await expectServiceError(find([group.id, foreignGroup.id]), 'not_found');
    await expectServiceError(find([group.id, deletedGroup.id]), 'precondition_failed');
  });

  it('deletes a group, detaching its servers and unlocking tokens without other groups', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let server = await createServer(fixture);
    let outside = await createServer(fixture);
    let doomed = await createGroup(fixture, [server]);
    let remaining = await createGroup(fixture, [server]);
    let onlyDoomed = await createToken(fixture, { groups: [doomed] });
    let both = await createToken(fixture, { groups: [doomed, remaining] });

    let deleted = await magicMcpGroupService.deleteMagicMcpGroup({
      group: doomed,
      auditScope: fixture.auditScope
    });
    expect(deleted.status).toBe('deleted');
    expect(deleted.deletedAt).toBeTruthy();
    expect(
      await db.magicMcpGroupServer.count({ where: { magicMcpGroupOid: doomed.oid } })
    ).toBe(0);

    let reloadedBoth = await reload(fixture, both);
    expect(reloadedBoth.isGroupLocked).toBe(true);
    expect(reloadedBoth.groups.map(link => link.magicMcpGroup.id)).toEqual([remaining.id]);
    expect(await hasAccess(reloadedBoth, { server: outside })).toBe(false);

    let reloadedOnly = await reload(fixture, onlyDoomed);
    expect(reloadedOnly.isGroupLocked).toBe(false);
    expect(await hasAccess(reloadedOnly, { server: outside })).toBe(true);

    let active = ids(
      await firstPage(
        await magicMcpGroupService.listMagicMcpGroups({ instance: fixture.instance })
      )
    );
    expect(active).not.toContain(doomed.id);
    let deletedList = ids(
      await firstPage(
        await magicMcpGroupService.listMagicMcpGroups({
          instance: fixture.instance,
          status: ['deleted']
        })
      )
    );
    expect(deletedList).toContain(doomed.id);

    let serverChange = {
      group: deleted,
      serverIds: [server.id],
      auditScope: fixture.auditScope
    };
    await expectServiceError(
      magicMcpGroupService.deleteMagicMcpGroup({
        group: deleted,
        auditScope: fixture.auditScope
      }),
      'gone'
    );
    await expectServiceError(magicMcpGroupService.addServersToGroup(serverChange), 'gone');
    await expectServiceError(
      magicMcpGroupService.removeServersFromGroup(serverChange),
      'gone'
    );
  });

  it('hides groups from another organization', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let group = await createGroup(fixture);

    await expectServiceError(
      magicMcpGroupService.getMagicMcpGroupById({
        instance: other.instance,
        magicMcpGroupId: group.id
      }),
      'not_found'
    );
    expect(
      ids(
        await firstPage(
          await magicMcpGroupService.listMagicMcpGroups({ instance: other.instance })
        )
      )
    ).not.toContain(group.id);
  });
});
