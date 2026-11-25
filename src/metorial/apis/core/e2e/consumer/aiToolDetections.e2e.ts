import {
  eventuallyAudited,
  expectAuthMatrix,
  expectError,
  expectOk,
  expectPresented,
  listAll,
  metorialEndpoints,
  rest,
  useOrganization,
  API_VERSIONS,
  type BootstrappedOrganization
} from '@metorial/e2e';
import { db } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import { checkInBody, signInDesktop } from './_desktop';
import {
  createPortal,
  crossTenantClients,
  ids,
  instancePathFor,
  startConsumerSession
} from './_shared';

let finding = (toolKey: string, overrides: Record<string, unknown> = {}) => ({
  tool_key: toolKey,
  state: 'installed',
  confidence: 'medium',
  signal_kinds: ['config_dir'],
  ...overrides
});

let reportBody = (seq: number, findings: unknown[]) => ({
  seq,
  generated_at: new Date().toISOString(),
  catalog_version: 'e2e',
  findings
});

let settingsPath = (org: BootstrappedOrganization) =>
  instancePathFor(org, 'session', '/consumer-device-settings');

let enableDetection = async (org: BootstrappedOrganization) =>
  expectOk(
    await org.clients.rest.patch(settingsPath(org), {
      privacy_notice_accepted: true,
      ai_tool_detection_enabled: true
    })
  );

let enrollDesktop = async (org: BootstrappedOrganization) => {
  let portal = await createPortal(org);
  let desktop = await signInDesktop(org, portal.id);
  let body = checkInBody();
  let device = expectOk(await desktop.client.post('/consumer/devices/check-in', body));

  return { ...desktop, portal, device, installationId: body.installation_id };
};

describe('api-core consumer: AI tool detection', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let settingsOrg = useOrganization();
  let toggleOrg = useOrganization();
  let connectionOrg = useOrganization();

  it('lets admins turn detection on only after accepting the privacy notice', async () => {
    let tenants = crossTenantClients(settingsOrg, otherOrg);

    await expectAuthMatrix(
      tenants,
      (client, name) =>
        client.get(instancePathFor(settingsOrg, name, '/consumer-device-settings')),
      {
        none: 401,
        session: 200,
        management: 200,
        instance: 200,
        otherSession: 404,
        otherManagement: 404,
        otherInstance: 200
      }
    );

    let initial = expectPresented(
      expectOk(await settingsOrg.clients.instance.get('/consumer-device-settings')),
      'consumer.device_settings'
    );
    expect(initial).toMatchObject({
      instance_id: settingsOrg.ids.instanceId,
      ai_tool_detection_enabled: false,
      connection_mode: 'local_proxy',
      privacy_notice_accepted_at: null,
      updated_at: null
    });

    expectError(
      await settingsOrg.clients.instance.patch('/consumer-device-settings', {
        ai_tool_detection_enabled: 'sometimes'
      }),
      400,
      'invalid_data'
    );
    expectError(
      await settingsOrg.clients.rest.patch(settingsPath(settingsOrg), {
        ai_tool_detection_enabled: true
      }),
      412
    );
    for (let body of [
      { ai_tool_detection_enabled: true },
      { privacy_notice_accepted: true }
    ]) {
      expectError(
        await settingsOrg.clients.instance.patch('/consumer-device-settings', body),
        403
      );
      expectError(
        await settingsOrg.clients.management.patch(
          instancePathFor(settingsOrg, 'management', '/consumer-device-settings'),
          body
        ),
        403
      );
    }

    let enabled = await enableDetection(settingsOrg);
    expect(enabled.ai_tool_detection_enabled).toBe(true);
    expect(typeof enabled.privacy_notice_accepted_at).toBe('string');

    expectError(
      await settingsOrg.clients.instance.patch('/consumer-device-settings', {
        privacy_notice_accepted: false
      }),
      412
    );

    await eventuallyAudited(async () => {
      let body = expectOk(
        await settingsOrg.clients.management.get('/organization/audit-logs', {
          query: { limit: 100 }
        })
      );
      let found = body.items.filter(
        (item: any) => item.resource == 'consumer_device_settings'
      );
      if (!found.length) throw new Error('settings not audited yet');
    });
  });

  it('lets admins choose how devices connect AI tools and tells devices at check-in', async () => {
    let initial = await enrollDesktop(connectionOrg);
    expect(initial.device.install).toEqual({ connection_mode: 'local_proxy' });

    expectError(
      await connectionOrg.clients.instance.patch('/consumer-device-settings', {
        connection_mode: 'sometimes'
      }),
      400,
      'invalid_data'
    );
    expectError(
      await connectionOrg.clients.instance.patch('/consumer-device-settings', {
        connection_mode: 'direct'
      }),
      403
    );

    let direct = expectOk(
      await connectionOrg.clients.rest.patch(settingsPath(connectionOrg), {
        connection_mode: 'direct'
      })
    );
    expect(direct).toMatchObject({
      connection_mode: 'direct',
      ai_tool_detection_enabled: false,
      privacy_notice_accepted_at: null
    });

    let checkedIn = expectOk(
      await initial.client.post(
        '/consumer/devices/check-in',
        checkInBody({ installation_id: initial.installationId })
      )
    );
    expect(checkedIn.install).toEqual({ connection_mode: 'direct' });

    let proxied = expectOk(
      await connectionOrg.clients.instance.patch('/consumer-device-settings', {
        connection_mode: 'local_proxy'
      })
    );
    expect(proxied.connection_mode).toBe('local_proxy');
  });

  it('tells the device at check-in whether to monitor AI tools', async () => {
    await enableDetection(org);
    let enabled = await enrollDesktop(org);
    let disabled = await enrollDesktop(otherOrg);

    expect(enabled.device.monitor).toMatchObject({
      ai_tool_detection: true,
      catalog_version: expect.stringMatching(/^[0-9a-f]{16}$/),
      intervals: expect.objectContaining({ processes: 900, report: 86400 })
    });
    expect(disabled.device.monitor.ai_tool_detection).toBe(false);
    expect(enabled.device.detections).toEqual([]);
  });

  it('serves the detection catalog the device matches against', async () => {
    let desktop = await enrollDesktop(org);

    expectError(
      await rest(metorialEndpoints().api, { version: API_VERSIONS.magnetar }).get(
        '/consumer/device-detection-catalog'
      ),
      401
    );

    let catalog = expectPresented(
      expectOk(await desktop.client.get('/consumer/device-detection-catalog')),
      'consumer.device.detection_catalog'
    );
    expect(catalog.version).toBe(desktop.device.monitor.catalog_version);
    expect(catalog.tools.map((tool: any) => tool.key)).toEqual(
      expect.arrayContaining(['claude-code', 'codex', 'cursor'])
    );
    expect(JSON.stringify(catalog)).not.toContain('slates');
  });

  it('stores reported tools once per sequence number', async () => {
    await enableDetection(org);
    let desktop = await enrollDesktop(org);
    let path = `/consumer/devices/${desktop.device.id}/detections`;

    let report = expectPresented(
      expectOk(
        await desktop.client.post(
          path,
          reportBody(1, [
            finding('cursor', { signal_kinds: ['app', 'config_dir'], confidence: 'high' }),
            finding('not-a-real-tool')
          ])
        )
      ),
      'consumer.device.detection_report'
    );
    expect(report).toMatchObject({
      consumer_device_id: desktop.device.id,
      applied: true,
      seq: 1,
      catalog_version: desktop.device.monitor.catalog_version
    });
    expect(report.detections).toEqual([
      expect.objectContaining({
        object: 'consumer.device.detection',
        tool_key: 'cursor',
        tool_name: 'Cursor',
        confidence: 'high',
        signal_kinds: ['app', 'config_dir']
      })
    ]);

    let repeated = expectOk(await desktop.client.post(path, reportBody(1, [])));
    expect(repeated).toMatchObject({ applied: false, seq: 1 });
    expect(repeated.detections.map((detection: any) => detection.tool_key)).toEqual([
      'cursor'
    ]);

    let device = expectOk(await desktop.client.get(`/consumer/devices/${desktop.device.id}`));
    expect(device.detections.map((detection: any) => detection.tool_key)).toEqual(['cursor']);
  });

  it('validates reports and refuses them while detection is off', async () => {
    await enableDetection(org);
    let desktop = await enrollDesktop(org);
    let neighbour = await enrollDesktop(org);
    let disabled = await enrollDesktop(otherOrg);
    let path = `/consumer/devices/${desktop.device.id}/detections`;

    for (let body of [
      reportBody(0, []),
      reportBody(1.5, []),
      reportBody(1, [finding('cursor', { state: 'sleeping' })]),
      reportBody(1, [finding('cursor', { signal_kinds: [] })]),
      reportBody(1, [finding('Not A Key')]),
      reportBody(1, [finding('cursor', { version: '1.0 beta' })]),
      reportBody(
        1,
        Array.from({ length: 201 }, () => finding('cursor'))
      )
    ])
      expectError(await desktop.client.post(path, body), 400, 'invalid_data');

    expectError(
      await neighbour.client.post(path, reportBody(1, [finding('cursor')])),
      404,
      'not_found'
    );

    let portalSession = await startConsumerSession(desktop.portal.id, desktop.profile);
    expectError(
      await portalSession.magnetar.post(path, reportBody(1, [finding('cursor')])),
      412,
      'precondition_failed'
    );
    expectError(
      await disabled.client.post(
        `/consumer/devices/${disabled.device.id}/detections`,
        reportBody(1, [finding('cursor')])
      ),
      403,
      'detection_disabled'
    );
  });

  it('lets admins review AI tools and mark them sanctioned or not', async () => {
    await enableDetection(org);
    let desktop = await enrollDesktop(org);
    expectOk(
      await desktop.client.post(
        `/consumer/devices/${desktop.device.id}/detections`,
        reportBody(1, [finding('lm-studio', { state: 'running', signal_kinds: ['process'] })])
      )
    );
    let tenants = crossTenantClients(org, otherOrg);

    await expectAuthMatrix(
      tenants,
      (client, name) => client.get(instancePathFor(org, name, '/ai-tools/lm-studio')),
      {
        none: 401,
        session: 200,
        management: 200,
        instance: 200,
        otherSession: 404,
        otherManagement: 404,
        otherInstance: 200
      }
    );

    let detected = expectOk(
      await org.clients.instance.get('/ai-tools', { query: { detected: true } })
    );
    let tool = detected.items.find((item: any) => item.key == 'lm-studio');
    expectPresented(tool, 'ai_tool');
    expect(tool).toMatchObject({
      name: 'LM Studio',
      maker: { id: 'lmstudio' },
      policy: { status: 'unreviewed', note: null, decided_at: null }
    });
    expect(tool.device_count).toBeGreaterThanOrEqual(1);
    expect(tool.people_count).toBeGreaterThanOrEqual(1);
    expect(
      expectOk(await otherOrg.clients.instance.get('/ai-tools/lm-studio')).device_count
    ).toBe(0);

    expectError(await org.clients.instance.get('/ai-tools/not-a-real-tool'), 404, 'not_found');
    expectError(
      await org.clients.instance.patch('/ai-tools/lm-studio/policy', { status: 'banned' }),
      400,
      'invalid_data'
    );
    expectError(
      await org.clients.instance.patch('/ai-tools/lm-studio/policy', {
        note: 'x'.repeat(1001)
      }),
      400,
      'invalid_data'
    );

    let updated = expectOk(
      await org.clients.instance.patch('/ai-tools/lm-studio/policy', {
        status: 'not_sanctioned',
        note: 'Use the approved gateway instead.'
      })
    );
    expect(updated.policy).toMatchObject({
      status: 'not_sanctioned',
      note: 'Use the approved gateway instead.'
    });

    let shadow = expectOk(
      await org.clients.instance.get('/ai-tools', {
        query: { policy_status: ['not_sanctioned', 'unreviewed'] }
      })
    );
    expect(shadow.items.map((item: any) => item.key)).toContain('lm-studio');
    expect(shadow.items.every((item: any) => item.policy.status != 'sanctioned')).toBe(true);

    await eventuallyAudited(async () => {
      let body = expectOk(
        await org.clients.management.get('/organization/audit-logs', { query: { limit: 100 } })
      );
      let found = body.items.filter((item: any) => item.resource == 'ai_tool_policy');
      if (!found.length) throw new Error('policy not audited yet');
    });
  });

  it('lists detections per device and consumer for admins of the instance only', async () => {
    await enableDetection(org);
    let desktop = await enrollDesktop(org);
    let path = `/consumer/devices/${desktop.device.id}/detections`;
    expectOk(
      await desktop.client.post(
        path,
        reportBody(1, [finding('ollama'), finding('perplexity')])
      )
    );
    expectOk(await desktop.client.post(path, reportBody(2, [finding('ollama')])));

    let present = await listAll(org.clients.instance, '/ai-tool-detections', {
      query: { consumer_device_id: desktop.device.id },
      limit: 1
    });
    expect(present.map(item => item.tool_key)).toEqual(['ollama']);
    expect(expectPresented(present[0], 'ai_tool.detection')).toMatchObject({
      consumer_device_id: desktop.device.id,
      stale: false,
      consumer_profile_id: desktop.profile.id,
      policy_status: expect.any(String),
      gone_at: null
    });

    let gone = await listAll(org.clients.instance, '/ai-tool-detections', {
      query: { consumer_device_id: desktop.device.id, status: 'gone' }
    });
    expect(gone.map(item => item.tool_key)).toEqual(['perplexity']);
    expect(typeof gone[0].gone_at).toBe('string');

    let byConsumer = await listAll(org.clients.instance, '/ai-tool-detections', {
      query: { consumer_id: present[0].consumer_id, tool_key: 'ollama' }
    });
    expect(ids(byConsumer)).toEqual([present[0].id]);

    for (let query of [
      { status: 'missing' },
      { consumer_device_id: Array.from({ length: 101 }, (_, index) => `codv_${index}`) }
    ])
      expectError(
        await org.clients.instance.get('/ai-tool-detections', { query }),
        400,
        'invalid_data'
      );
    expect(
      await listAll(otherOrg.clients.instance, '/ai-tool-detections', {
        query: { consumer_device_id: desktop.device.id }
      })
    ).toEqual([]);

    let adminDevice = expectOk(
      await org.clients.instance.get(`/consumer-devices/${desktop.device.id}`)
    );
    expect(adminDevice.detections.map((detection: any) => detection.tool_key)).toEqual([
      'ollama'
    ]);
    expect(adminDevice).not.toHaveProperty('monitor');
  });

  it('marks detections of a device that stopped reporting as stale', async () => {
    await enableDetection(org);
    let desktop = await enrollDesktop(org);
    expectOk(
      await desktop.client.post(
        `/consumer/devices/${desktop.device.id}/detections`,
        reportBody(1, [finding('goose')])
      )
    );
    await db.consumerDevice.update({
      where: { id: desktop.device.id },
      data: { detectionReportedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000) }
    });

    let [detection] = await listAll(org.clients.instance, '/ai-tool-detections', {
      query: { consumer_device_id: desktop.device.id }
    });
    expect(detection).toMatchObject({ tool_key: 'goose', stale: true });

    let device = expectOk(await desktop.client.get(`/consumer/devices/${desktop.device.id}`));
    expect(device.detections).toEqual([
      expect.objectContaining({ tool_key: 'goose', stale: true })
    ]);
  });

  it('stops showing detections once an admin turns detection off', async () => {
    await enableDetection(toggleOrg);
    let desktop = await enrollDesktop(toggleOrg);
    expectOk(
      await desktop.client.post(
        `/consumer/devices/${desktop.device.id}/detections`,
        reportBody(1, [finding('cursor')])
      )
    );
    expect(
      expectOk(await desktop.client.get(`/consumer/devices/${desktop.device.id}`)).detections
    ).toHaveLength(1);

    expectOk(
      await toggleOrg.clients.instance.patch('/consumer-device-settings', {
        ai_tool_detection_enabled: false
      })
    );

    let checkedIn = expectOk(
      await desktop.client.post(
        '/consumer/devices/check-in',
        checkInBody({ installation_id: desktop.installationId })
      )
    );
    expect(checkedIn).toMatchObject({ id: desktop.device.id, detections: [] });
    expect(checkedIn.monitor.ai_tool_detection).toBe(false);
    expect(
      expectOk(await desktop.client.get(`/consumer/devices/${desktop.device.id}`)).detections
    ).toEqual([]);
    expect(
      expectOk(await toggleOrg.clients.instance.get(`/consumer-devices/${desktop.device.id}`))
        .detections
    ).toEqual([]);
    expect(
      await listAll(toggleOrg.clients.instance, '/ai-tool-detections', {
        query: { consumer_device_id: desktop.device.id }
      })
    ).toEqual([]);
  });
});
