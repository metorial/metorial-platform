import { ID } from '@metorial/db';
import {
  eventually,
  expectServiceError,
  uniqueEmail,
  uniqueId,
  useOrganization
} from '@metorial/e2e';
import {
  agentTracking,
  claudeCodeEventRecord,
  claudeRequest,
  expectIngested,
  sendClaudeCodeLogs,
  sendClaudeCodeRequests,
  trackedInstance
} from '@metorial/agent-tracking-e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import { agentTrackingSettingsService } from '@metorial/module-agent-tracking-sync';
import {
  consumerDeviceService,
  consumerProfileService,
  consumerSurfaceService
} from '@metorial/module-consumer-core';
import { describe, expect, it } from 'vitest';
import { agentTrackingTokenService } from '../src';

let defaultDesktop = {
  toolDetails: false,
  sessionContext: true,
  sessionTitles: false,
  historyImport: false
};

let createDevice = async (fixture: OrganizationFixture) => {
  let surface = await consumerSurfaceService.createConsumerSurface({
    organization: fixture.organization,
    instance: fixture.instance,
    context: fixture.context,
    auditScope: fixture.auditScope,
    type: 'portal',
    input: { name: uniqueId('Surface'), sessionExpiryTimeInSeconds: 3600 }
  });
  let consumerProfile = await consumerProfileService.createConsumerProfile({
    surface,
    email: uniqueEmail('device'),
    name: 'E2E Profile',
    auditScope: fixture.auditScope
  });

  return await db.consumerDevice.create({
    data: {
      id: await ID.generateId('consumerDevice'),
      installationId: uniqueId('installation'),
      name: 'E2E MacBook',
      os: 'macos',
      arch: 'aarch64',
      appVersion: '0.2.0',
      consumerProfileOid: consumerProfile.oid,
      instanceOid: fixture.instance.oid
    }
  });
};

let issue = async (fixture: OrganizationFixture, consumerDevice: { oid: bigint }) =>
  await agentTrackingTokenService.issueDeviceToken({
    consumerDevice,
    auditScope: fixture.auditScope
  });

let tokenStatus = async (serviceIngestTokenId: string) =>
  (await db.agentTrackingIngestToken.findFirstOrThrow({ where: { serviceIngestTokenId } }))
    .status;

let waitForRevoked = (serviceIngestTokenId: string) =>
  eventually(async () => expect(await tokenStatus(serviceIngestTokenId)).toBe('revoked'), {
    timeoutMs: 30_000,
    intervalMs: 500
  });

describe('module-agent-tracking-access device tokens', () => {
  let org = useOrganization();

  it('issues a token bound to the device and its consumer', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let device = await createDevice(fixture);

    let issued = await issue(fixture, device);
    expect(issued.secret.startsWith('metorial_agit_')).toBe(true);
    expect(typeof issued.ingestUrl).toBe('string');

    let rows = await db.agentTrackingIngestToken.findMany({
      where: { consumerDeviceOid: device.oid }
    });
    expect(rows).toHaveLength(1);
    let consumerProfile = await db.consumerProfile.findUniqueOrThrow({
      where: { oid: device.consumerProfileOid },
      include: { consumer: true }
    });
    expect(rows[0]).toMatchObject({
      status: 'active',
      deviceMode: 'bound',
      serviceIngestTokenId: issued.ingestToken.serviceIngestTokenId,
      consumerOid: consumerProfile.consumer.oid,
      consumerDeviceOid: device.oid
    });
    expect(
      JSON.stringify(rows[0], (_, value) => (typeof value == 'bigint' ? `${value}` : value))
    ).not.toContain(issued.secret);

    let serviceToken = await agentTracking().ingestToken.get({
      organizationId: org.ids.organizationId,
      ingestTokenId: issued.ingestToken.serviceIngestTokenId
    });
    expect(serviceToken).toMatchObject({
      id: issued.ingestToken.serviceIngestTokenId,
      userRef: consumerProfile.consumer.id,
      deviceRef: device.id
    });
  });

  it('replaces the older token after commit and reports the newest one as active', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let device = await createDevice(fixture);

    let replaced = await issue(fixture, device);
    let current = await issue(fixture, device);
    expect(current.secret).not.toBe(replaced.secret);

    let telemetry = await agentTrackingTokenService.listDeviceTelemetry({
      organization: fixture.organization,
      project: fixture.project,
      consumerDevices: [device]
    });
    expect(telemetry.get(device.oid)).toEqual({
      enabled: true,
      directExport: true,
      tokenId: current.ingestToken.serviceIngestTokenId,
      ...defaultDesktop
    });

    await waitForRevoked(replaced.ingestToken.serviceIngestTokenId);
    expect(await tokenStatus(current.ingestToken.serviceIngestTokenId)).toBe('active');

    let send = (token: typeof current) =>
      sendClaudeCodeRequests({ ingestUrl: token.ingestUrl, secret: token.secret }, [
        claudeRequest()
      ]);
    await eventually(async () => expect((await send(replaced)).status).toBe(401), {
      timeoutMs: 30_000,
      intervalMs: 1_000
    });
    await expectIngested(await send(current));
  }, 90_000);

  it('revokes the tokens of a device that ends and issues none to it', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let device = await createDevice(fixture);
    let issued = await issue(fixture, device);

    await consumerDeviceService.revokeDevice({
      consumerDevice: await consumerDeviceService.getDeviceById({
        instance: fixture.instance,
        consumerDeviceId: device.id
      }),
      auditScope: fixture.auditScope
    });

    await waitForRevoked(issued.ingestToken.serviceIngestTokenId);
    await eventually(
      async () =>
        expect(
          (
            await sendClaudeCodeRequests(
              { ingestUrl: issued.ingestUrl, secret: issued.secret },
              [claudeRequest()]
            )
          ).status
        ).toBe(401),
      { timeoutMs: 30_000, intervalMs: 1_000 }
    );
    await expectServiceError(issue(fixture, device), 'precondition_failed');

    let telemetry = await agentTrackingTokenService.listDeviceTelemetry({
      organization: fixture.organization,
      project: fixture.project,
      consumerDevices: [{ oid: device.oid, status: 'revoked' }]
    });
    expect(telemetry.get(device.oid)).toEqual({
      enabled: true,
      directExport: true,
      tokenId: null,
      ...defaultDesktop
    });
  }, 90_000);
});

describe('module-agent-tracking-access device telemetry settings', () => {
  let org = useOrganization();

  it('carries the Desktop settings of the organization to every device', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let device = await createDevice(fixture);
    let desktop = {
      toolDetails: true,
      sessionContext: false,
      sessionTitles: true,
      historyImport: true
    };

    await agentTrackingSettingsService.updateOrganizationSettings({
      organization: fixture.organization,
      auditScope: fixture.auditScope,
      input: { desktop }
    });

    let telemetry = await agentTrackingTokenService.listDeviceTelemetry({
      organization: fixture.organization,
      project: fixture.project,
      consumerDevices: [device]
    });
    expect(telemetry.get(device.oid)).toEqual({
      enabled: true,
      directExport: true,
      tokenId: null,
      ...desktop
    });
  });
});

describe('module-agent-tracking-access device telemetry filtering', () => {
  let org = useOrganization();

  it('takes tool details out of what a device sends while detailed tool reporting is off', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let device = await createDevice(fixture);
    let issued = await issue(fixture, device);
    let sessionId = uniqueId('session');
    let sentinel = uniqueId('SENTINEL');

    await expectIngested(
      await sendClaudeCodeLogs({ ingestUrl: issued.ingestUrl, secret: issued.secret }, [
        claudeCodeEventRecord({
          event: 'tool_result',
          sessionId,
          at: new Date(),
          attributes: {
            tool_use_id: uniqueId('tool'),
            tool_name: 'mcp__github__create_pr',
            success: 'true',
            tool_parameters: JSON.stringify({ mcp_server_name: 'github', title: sentinel }),
            tool_input: JSON.stringify({ title: sentinel })
          }
        })
      ])
    );

    let instance = await trackedInstance(org.ids);

    await eventually(
      async () => {
        let { items } = await agentTracking().records.list({ instanceId: instance.id });
        let call = items
          .map((item: any) => item.record)
          .find(
            (record: any) => record.type == 'tool.call' && record.ctx.session_id == sessionId
          );

        expect(call?.data.tool).toEqual({ name: 'mcp_tool', kind: 'mcp', class: 'mcp' });
        expect(call?.content).toEqual([]);
        expect(JSON.stringify(call)).not.toContain(sentinel);
      },
      { timeoutMs: 60_000, intervalMs: 1_000 }
    );
  });
});
