import { expectServiceError, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture } from '@metorial/e2e/db';
import { magicMcpTokenService } from '@metorial/module-magic';
import { describe, expect, it } from 'vitest';
import { consumerIntegrationService } from '../src';
import { createMagicServer, createProfile, createSurface } from './_fixtures';

describe('module-consumer-entities consumer integrations', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  it('upserts one integration per consumer and server without re-managing a manual one', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createSurface(fixture);
    let profile = await createProfile(fixture, surface);
    let otherProfile = await createProfile(fixture, surface);
    let server = await createMagicServer(fixture);

    let managed = await consumerIntegrationService.upsertConsumerIntegration({
      consumerProfile: profile,
      magicMcpServer: server,
      isManaged: true
    });
    expect(managed).toMatchObject({
      isManaged: true,
      consumerProfileOid: profile.oid,
      consumerOid: profile.consumerOid,
      instanceOid: fixture.instance.oid
    });
    expect(managed.magicMcpServer.id).toBe(server.id);

    let manual = await consumerIntegrationService.upsertConsumerIntegration({
      consumerProfile: profile,
      magicMcpServer: server,
      isManaged: false
    });
    expect(manual.id).toBe(managed.id);
    expect(manual.isManaged).toBe(false);

    let remanaged = await consumerIntegrationService.upsertConsumerIntegration({
      consumerProfile: profile,
      magicMcpServer: server,
      isManaged: true
    });
    expect(remanaged.id).toBe(managed.id);
    expect(remanaged.isManaged).toBe(false);

    let other = await consumerIntegrationService.upsertConsumerIntegration({
      consumerProfile: otherProfile,
      magicMcpServer: server,
      isManaged: true
    });
    expect(other.id).not.toBe(managed.id);
    expect(
      await db.consumerIntegration.count({ where: { magicMcpServerOid: server.oid } })
    ).toBe(2);
  });

  it('rejects servers, tokens and sessions of another instance', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let surface = await createSurface(fixture);
    let profile = await createProfile(fixture, surface);
    let foreignServer = await createMagicServer(other);
    let foreignToken = await magicMcpTokenService.createMagicMcpToken({
      instance: other.instance,
      auditScope: other.auditScope,
      input: { magicMcpServer: foreignServer }
    });

    await expectServiceError(
      consumerIntegrationService.upsertConsumerIntegration({
        consumerProfile: profile,
        magicMcpServer: foreignServer,
        isManaged: true
      }),
      'precondition_failed'
    );
    await expectServiceError(
      consumerIntegrationService.upsertConsumerToken({
        consumerProfile: profile,
        magicMcpToken: foreignToken
      }),
      'precondition_failed'
    );

    let server = await createMagicServer(fixture);
    let integration = await consumerIntegrationService.upsertConsumerIntegration({
      consumerProfile: profile,
      magicMcpServer: server,
      isManaged: true
    });
    await expectServiceError(
      consumerIntegrationService.upsertConsumerIntegrationSession({
        consumerProfile: profile,
        consumerIntegration: integration,
        magicMcpSession: { oid: -1n, instanceOid: other.instance.oid }
      }),
      'precondition_failed'
    );

    expect(
      await db.consumerIntegration.count({ where: { magicMcpServerOid: foreignServer.oid } })
    ).toBe(0);
    expect(
      await db.consumerToken.count({ where: { magicMcpTokenOid: foreignToken.oid } })
    ).toBe(0);
  });

  it("refuses to attach sessions to another consumer's integration", async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createSurface(fixture);
    let owner = await createProfile(fixture, surface);
    let intruder = await createProfile(fixture, surface);
    let server = await createMagicServer(fixture);
    let integration = await consumerIntegrationService.upsertConsumerIntegration({
      consumerProfile: owner,
      magicMcpServer: server,
      isManaged: true
    });

    await expectServiceError(
      consumerIntegrationService.upsertConsumerIntegrationSession({
        consumerProfile: intruder,
        consumerIntegration: integration,
        magicMcpSession: { oid: -1n, instanceOid: fixture.instance.oid }
      }),
      'precondition_failed'
    );
    expect(
      await db.consumerIntegrationSession.count({
        where: { consumerIntegrationOid: integration.oid }
      })
    ).toBe(0);
  });

  it('upserts consumer tokens per consumer and token', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createSurface(fixture);
    let profile = await createProfile(fixture, surface);
    let otherProfile = await createProfile(fixture, surface);
    let server = await createMagicServer(fixture);
    let token = await magicMcpTokenService.createMagicMcpToken({
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      input: { magicMcpServer: server }
    });

    let consumerToken = await consumerIntegrationService.upsertConsumerToken({
      consumerProfile: profile,
      magicMcpToken: token
    });
    expect(consumerToken.magicMcpToken.id).toBe(token.id);
    expect(consumerToken.consumerProfile.id).toBe(profile.id);

    let again = await consumerIntegrationService.upsertConsumerToken({
      consumerProfile: profile,
      magicMcpToken: token
    });
    expect(again.id).toBe(consumerToken.id);

    let otherToken = await consumerIntegrationService.upsertConsumerToken({
      consumerProfile: otherProfile,
      magicMcpToken: token
    });
    expect(otherToken.id).not.toBe(consumerToken.id);
    expect(await db.consumerToken.count({ where: { magicMcpTokenOid: token.oid } })).toBe(2);

    expect(
      await consumerIntegrationService.findLatestConsumerAuthClientForMagicMcpToken({
        magicMcpToken: token
      })
    ).toBeNull();
  });

  it('marks only the given magic resources as consumer-reconciled', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let reconciled = await createMagicServer(fixture);
    let untouched = await createMagicServer(fixture);
    let token = await magicMcpTokenService.createMagicMcpToken({
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      input: { magicMcpServer: reconciled }
    });
    await db.magicMcpServer.updateMany({
      where: { oid: { in: [reconciled.oid, untouched.oid] } },
      data: { isConsumerReconciled: false }
    });
    await db.magicMcpToken.update({
      where: { oid: token.oid },
      data: { isConsumerReconciled: false }
    });

    await consumerIntegrationService.markMagicMcpResourcesConsumerReconciled({
      magicMcpServers: [reconciled],
      magicMcpToken: token
    });

    let servers = await db.magicMcpServer.findMany({
      where: { oid: { in: [reconciled.oid, untouched.oid] } },
      select: { oid: true, isConsumerReconciled: true }
    });
    expect(
      Object.fromEntries(servers.map(item => [item.oid.toString(), item.isConsumerReconciled]))
    ).toEqual({
      [reconciled.oid.toString()]: true,
      [untouched.oid.toString()]: false
    });
    expect(
      (await db.magicMcpToken.findUniqueOrThrow({ where: { oid: token.oid } }))
        .isConsumerReconciled
    ).toBe(true);
  });
});
