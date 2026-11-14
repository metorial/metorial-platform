import { expectServiceError, firstPage, useOrganization } from '@metorial/e2e';
import { loadOrganizationFixture } from '@metorial/e2e/db';
import {
  consumerMagicMcpReadRoles,
  consumerMagicMcpWriteRoles
} from '@metorial/module-access';
import { describe, expect, it } from 'vitest';
import {
  magicMcpEndpointService,
  magicMcpServerService,
  magicMcpSessionService,
  magicMcpTokenService
} from '../src';
import {
  archiveServer,
  createAccessTag,
  createConsumer,
  createEndpoint,
  createServer,
  createToken,
  grantAccessTag,
  grantServerAccess,
  ids,
  listServerIds,
  syncSession
} from './_fixtures';

describe('module-magic consumer access', () => {
  let org = useOrganization();

  it('lets a consumer group read only the servers it was granted', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let consumer = await createConsumer(fixture);
    let granted = await createServer(fixture);
    let hidden = await createServer(fixture);
    await grantServerAccess(fixture, consumer, granted);
    let accessTags = consumer.accessTagOid;

    await magicMcpServerService.checkConsumerReadAccess({ server: granted, accessTags });
    await expectServiceError(
      magicMcpServerService.checkConsumerReadAccess({ server: hidden, accessTags }),
      'forbidden'
    );

    let fetched = await magicMcpServerService.getMagicMcpServerById({
      instance: fixture.instance,
      magicMcpServerId: granted.id,
      accessTags
    });
    expect(fetched.id).toBe(granted.id);
    await expectServiceError(
      magicMcpServerService.getMagicMcpServerById({
        instance: fixture.instance,
        magicMcpServerId: hidden.id,
        accessTags
      }),
      'forbidden'
    );
    expect(await listServerIds(fixture, { accessTags })).toEqual([granted.id]);

    await archiveServer(fixture, granted);
    await expectServiceError(
      magicMcpServerService.getMagicMcpServerById({
        instance: fixture.instance,
        magicMcpServerId: granted.id,
        accessTags
      }),
      'not_found'
    );
    expect(await listServerIds(fixture, { accessTags, status: ['archived'] })).toEqual([]);
  });

  it('lets a consumer surface read servers shared with any of its groups by id', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let consumer = await createConsumer(fixture);
    let otherConsumer = await createConsumer(fixture);
    let shared = await createServer(fixture);
    let hidden = await createServer(fixture);
    await grantServerAccess(fixture, consumer, shared);
    let unrelatedTag = await createAccessTag(fixture);
    let accessTags = unrelatedTag.oid;

    await magicMcpServerService.checkConsumerReadAccess({
      server: shared,
      accessTags,
      consumerSurface: consumer.surface
    });
    await expectServiceError(
      magicMcpServerService.checkConsumerReadAccess({ server: shared, accessTags }),
      'forbidden'
    );
    await expectServiceError(
      magicMcpServerService.checkConsumerReadAccess({
        server: shared,
        accessTags,
        consumerSurface: otherConsumer.surface
      }),
      'forbidden'
    );
    await expectServiceError(
      magicMcpServerService.checkConsumerReadAccess({
        server: hidden,
        accessTags,
        consumerSurface: consumer.surface
      }),
      'forbidden'
    );

    expect(
      await listServerIds(fixture, {
        accessTags,
        ids: [shared.id, hidden.id],
        consumerSurface: consumer.surface
      })
    ).toEqual([shared.id]);
    expect(
      await listServerIds(fixture, { accessTags, consumerSurface: consumer.surface })
    ).toEqual([]);
  });

  it('requires the write role for consumer server writes', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let consumer = await createConsumer(fixture);
    let server = await createServer(fixture);
    await grantServerAccess(fixture, consumer, server);
    let accessTags = consumer.accessTagOid;

    await expectServiceError(
      magicMcpServerService.checkWriteAccess({ server, accessTags }),
      'forbidden'
    );
    await expectServiceError(
      magicMcpServerService.updateMagicMcpServer({
        server,
        accessTags,
        auditScope: fixture.auditScope,
        input: { name: 'Consumer rename' }
      }),
      'forbidden'
    );

    await grantAccessTag(fixture, {
      accessTagOid: consumer.accessTagOid,
      roles: consumerMagicMcpWriteRoles,
      target: { magicMcpServerOid: server.oid }
    });
    await magicMcpServerService.checkWriteAccess({ server, accessTags });

    let updated = await magicMcpServerService.updateMagicMcpServer({
      server,
      accessTags,
      auditScope: fixture.auditScope,
      input: { name: 'Consumer rename' }
    });
    expect(updated.name).toBe('Consumer rename');
  });

  it('hides ungranted endpoints from consumers', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let accessTag = await createAccessTag(fixture);
    let server = await createServer(fixture);
    let granted = await createEndpoint(fixture, [server]);
    let hidden = await createEndpoint(fixture, [server]);
    await grantAccessTag(fixture, {
      accessTagOid: accessTag.oid,
      roles: consumerMagicMcpReadRoles,
      target: { magicMcpEndpointOid: granted.oid }
    });
    let accessTags = accessTag.oid;
    let get = (magicMcpEndpointId: string) =>
      magicMcpEndpointService.getMagicMcpEndpointById({
        instance: fixture.instance,
        magicMcpEndpointId,
        accessTags
      });

    expect((await get(granted.id)).id).toBe(granted.id);
    await expectServiceError(get(hidden.id), 'not_found');
    expect(
      ids(
        await firstPage(
          await magicMcpEndpointService.listMagicMcpEndpoints({
            instance: fixture.instance,
            accessTags
          })
        )
      )
    ).toEqual([granted.id]);

    await expectServiceError(
      magicMcpEndpointService.checkWriteAccess({ endpoint: granted, accessTags }),
      'not_found'
    );
    await grantAccessTag(fixture, {
      accessTagOid: accessTag.oid,
      roles: consumerMagicMcpWriteRoles,
      target: { magicMcpEndpointOid: granted.oid }
    });
    await magicMcpEndpointService.checkWriteAccess({ endpoint: granted, accessTags });

    await magicMcpEndpointService.archiveMagicMcpEndpoint({
      endpoint: granted,
      auditScope: fixture.auditScope
    });
    await expectServiceError(get(granted.id), 'not_found');
  });

  it('scopes consumer reads of tokens and sessions to granted resources', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let consumer = await createConsumer(fixture);
    let granted = await createServer(fixture);
    let hidden = await createServer(fixture);
    await grantServerAccess(fixture, consumer, granted);
    let accessTags = consumer.accessTagOid;

    let token = await createToken(fixture);
    let otherToken = await createToken(fixture);
    await grantAccessTag(fixture, {
      accessTagOid: consumer.accessTagOid,
      roles: consumerMagicMcpReadRoles,
      target: { magicMcpTokenOid: token.oid }
    });

    let fetchedToken = await magicMcpTokenService.getMagicMcpTokenById({
      instance: fixture.instance,
      magicMcpTokenId: token.id,
      accessTags
    });
    expect(fetchedToken.id).toBe(token.id);
    await expectServiceError(
      magicMcpTokenService.getMagicMcpTokenById({
        instance: fixture.instance,
        magicMcpTokenId: otherToken.id,
        accessTags
      }),
      'forbidden'
    );

    let grantedSession = await syncSession(granted.id);
    let hiddenSession = await syncSession(hidden.id);
    let sessionIds = ids(
      await firstPage(
        await magicMcpSessionService.listMagicMcpSessions({
          instance: fixture.instance,
          accessTags
        })
      )
    );
    expect(sessionIds).toContain(grantedSession.id);
    expect(sessionIds).not.toContain(hiddenSession.id);

    await expectServiceError(
      magicMcpSessionService.getMagicMcpSessionById({
        instance: fixture.instance,
        magicMcpSessionId: hiddenSession.id,
        accessTags
      }),
      'not_found'
    );
    let fetchedSession = await magicMcpSessionService.getMagicMcpSessionById({
      instance: fixture.instance,
      magicMcpSessionId: grantedSession.id,
      accessTags
    });
    expect(fetchedSession.id).toBe(grantedSession.id);
  });
});
