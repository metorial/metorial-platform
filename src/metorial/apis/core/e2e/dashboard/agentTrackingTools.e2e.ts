import {
  eventually,
  expectAuthMatrix,
  expectError,
  expectOk,
  expectPresented,
  uniqueEmail,
  uniqueId,
  useMember,
  useOrganization,
  type BootstrappedOrganization
} from '@metorial/e2e';
import {
  agentTrackingPath,
  agentTrackingSettingsPaths,
  claudeCodeEventRecord,
  claudeRequest,
  expectIngested,
  ingestFirstUsage,
  sendClaudeCodeLogs
} from '@metorial/agent-tracking-e2e';
import { ID } from '@metorial/db';
import { db, loadOrganizationFixture } from '@metorial/e2e/db';
import { beforeAll, describe, expect, it } from 'vitest';
import { adminOnly, adminOnlyClients } from '../_agentTracking';
import { createConsumerProfile, createPortal } from '../consumer/_shared';

let minuteMs = 60 * 1000;

let paths = ['/tools/skills', '/tools/mcp-servers'];

describe('api-core dashboard: agent tracking tools', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let member = useMember(org);

  it('lets only admins read', async () => {
    for (let path of paths) {
      await expectAuthMatrix(
        adminOnlyClients(org, member, otherOrg),
        client => client.get(agentTrackingPath(org, path)),
        adminOnly
      );
    }
  });

  it('answers 404 for an instance of another organization', async () => {
    for (let path of paths) {
      expectError(await org.clients.rest.get(agentTrackingPath(otherOrg, path)), 404);
    }
  });

  it('presents empty skill and MCP server usage', async () => {
    let skills = expectPresented(
      expectOk(
        await org.clients.rest.get(agentTrackingPath(org, '/tools/skills'), {
          query: { range: 'last_7_days', time_zone: 'Europe/Berlin' }
        })
      ),
      'agent_tracking.skill_usage'
    );
    expect(skills).toMatchObject({
      range: { preset: 'last_7_days', time_zone: 'Europe/Berlin' },
      tool_details: false,
      summary: { activations: 0, named_activations: 0, members: 0, counts_capped: false },
      items: [],
      truncated: false
    });

    let servers = expectPresented(
      expectOk(await org.clients.rest.get(agentTrackingPath(org, '/tools/mcp-servers'))),
      'agent_tracking.mcp_server_usage'
    );
    expect(servers).toMatchObject({
      range: { preset: 'last_30_days', time_zone: 'UTC' },
      summary: { calls: 0, named_calls: 0, error_rate: null, last_used_at: null },
      items: [],
      truncated: false
    });
  });

  it('validates the range', async () => {
    let read = (query: Record<string, string>) =>
      org.clients.rest.get(agentTrackingPath(org, '/tools/skills'), { query });

    expectError(await read({ range: 'last_year' }), 400, 'invalid_data');
    expectError(await read({ from: '2026-11-01T00:00:00.000Z' }), 400);
    expectError(
      await read({ from: '2026-06-01T00:00:00.000Z', to: '2026-10-01T00:00:00.000Z' }),
      400
    );
  });

  it('refuses while the organization hides individuals', async () => {
    let settings = agentTrackingSettingsPaths(org.ids).organization;
    expectOk(await org.clients.rest.patch(settings, { privacy: { hide_individuals: true } }));

    try {
      for (let path of paths) {
        expectError(
          await org.clients.rest.get(agentTrackingPath(org, path)),
          403,
          'agent_tracking_individuals_hidden'
        );
      }
    } finally {
      expectOk(
        await org.clients.rest.patch(settings, { privacy: { hide_individuals: false } })
      );
    }
  });
});

let installSkill = async (org: BootstrappedOrganization, name: string) => {
  let fixture = await loadOrganizationFixture(org.ids);
  let portal = await createPortal(org);
  let profile = await createConsumerProfile(org, portal.id);
  let consumerProfile = await db.consumerProfile.findUniqueOrThrow({
    where: { id: profile.id }
  });
  let device = await db.consumerDevice.create({
    data: {
      id: await ID.generateId('consumerDevice'),
      installationId: uniqueId('installation-0123456789'),
      name: 'E2E MacBook',
      os: 'macos',
      arch: 'aarch64',
      appVersion: '0.2.0',
      consumerProfileOid: consumerProfile.oid,
      instanceOid: fixture.instance.oid
    }
  });
  let skill = await db.skill.create({
    data: {
      id: await ID.generateId('skill'),
      name: uniqueId('Agent Skill'),
      storeId: uniqueId('store'),
      skillEntityId: uniqueId('entity'),
      organizationOid: fixture.organization.oid,
      projectOid: fixture.project.oid,
      instanceOid: fixture.instance.oid
    }
  });
  await db.consumerDeviceSkill.create({
    data: {
      id: await ID.generateId('consumerDeviceSkill'),
      name,
      consumerDeviceOid: device.oid,
      skillOid: skill.oid,
      instanceOid: fixture.instance.oid
    }
  });

  return skill;
};

describe('api-core dashboard: agent tracking tools of ingested usage', () => {
  let org = useOrganization();

  let email = uniqueEmail('agent-tools');
  let serverName = uniqueId('github');
  let skillName = uniqueId('pdf');

  beforeAll(async () => {
    expect(
      expectOk(
        await org.clients.rest.patch(agentTrackingSettingsPaths(org.ids).organization, {
          desktop: { tool_details: true }
        })
      )
    ).toMatchObject({ service_status: 'applied', desktop: { tool_details: true } });
    await installSkill(org, skillName);

    let now = Date.now();
    let sessionId = uniqueId('session');
    let source = await ingestFirstUsage(org, [
      claudeRequest({ sessionId, email, at: new Date(now - 5 * minuteMs) })
    ]);

    let at = new Date(now - 4 * minuteMs);
    let record = (event: string, attributes: Record<string, string>) =>
      claudeCodeEventRecord({ event, sessionId, email, at, attributes });

    await expectIngested(
      await sendClaudeCodeLogs({ ingestUrl: source.ingest_url, secret: source.secret }, [
        record('tool_result', {
          tool_use_id: uniqueId('tu'),
          tool_name: 'create_issue',
          mcp_server_name: serverName,
          success: 'true'
        }),
        record('tool_result', {
          tool_use_id: uniqueId('tu'),
          tool_name: 'create_issue',
          mcp_server_name: serverName,
          success: 'false',
          error_type: 'tool_error'
        }),
        record('tool_result', {
          tool_use_id: uniqueId('tu'),
          tool_name: 'mcp_tool',
          success: 'true'
        }),
        record('skill_activated', { 'skill.name': 'pdf', invocation_trigger: 'model' }),
        record('skill_activated', {
          'skill.name': skillName,
          invocation_trigger: 'model',
          'skill.source': 'userSettings'
        }),
        record('skill_activated', {
          'skill.name': 'custom_skill',
          invocation_trigger: 'model'
        })
      ])
    );
  }, 240_000);

  it('lists the MCP server with its tool and failures, and counts the redacted call', async () => {
    let usage = await eventually(
      async () => {
        let usage = expectOk(
          await org.clients.rest.get(agentTrackingPath(org, '/tools/mcp-servers'))
        );
        expect(usage.summary).toMatchObject({ calls: 3, named_calls: 2 });

        return usage;
      },
      { timeoutMs: 120_000, intervalMs: 2_000 }
    );

    expect(usage.summary).toMatchObject({ failed: 1, members: 1 });
    expect(usage.summary.error_rate).toBeCloseTo(1 / 3);
    expect(usage.items).toEqual([
      expect.objectContaining({
        name: serverName,
        calls: 2,
        failed: 1,
        error_rate: 0.5,
        members: 1,
        provider: null,
        tools: [expect.objectContaining({ name: 'create_issue', calls: 2, failed: 1 })]
      })
    ]);
  });

  it('lists the named skills, links none sent without a Metorial device, and counts the placeholder activation', async () => {
    let usage = await eventually(
      async () => {
        let usage = expectOk(
          await org.clients.rest.get(agentTrackingPath(org, '/tools/skills'))
        );
        expect(usage.summary).toMatchObject({ activations: 3, named_activations: 2 });

        return usage;
      },
      { timeoutMs: 120_000, intervalMs: 2_000 }
    );

    expect(usage.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'pdf', skill: null, activations: 1, members: 1 }),
        expect.objectContaining({ name: skillName, skill: null, activations: 1 })
      ])
    );
    expect(usage.items).toHaveLength(2);
  });
});
