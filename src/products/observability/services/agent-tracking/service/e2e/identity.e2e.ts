import { describe, expect, it } from 'vitest';
import {
  acceptedStatus,
  createSource,
  createToken,
  agentTracking,
  ingest,
  instanceRecords
} from './support';

let nowNanos = () => String(BigInt(Date.now()) * 1_000_000n);

let hook = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    session_id: 'session-1',
    hook_event_name: 'UserPromptSubmit',
    prompt: 'hello',
    ...overrides
  });

let claudeLogs = (attributes: Record<string, string>) =>
  JSON.stringify({
    resourceLogs: [
      {
        resource: {
          attributes: [{ key: 'service.name', value: { stringValue: 'claude-code' } }]
        },
        scopeLogs: [
          {
            scope: { name: 'com.anthropic.claude_code.events' },
            logRecords: [
              {
                timeUnixNano: nowNanos(),
                body: { stringValue: 'claude_code.user_prompt' },
                attributes: Object.entries({
                  'event.name': 'user_prompt',
                  'session.id': 'session-1',
                  ...attributes
                }).map(([key, value]) => ({ key, value: { stringValue: value } }))
              }
            ]
          }
        ]
      }
    ]
  });

let listEntities = async (organizationId: string, kind: string) =>
  (await agentTracking().entity.list({ organizationId, kinds: [kind] })).items;

describe('identity attribution', () => {
  it('stamps the bound user, device and a discovered agent', async () => {
    let { organization, instance, token, secret } = await createToken();

    let response = await ingest('/v1/ingest/hooks/claude-code', {
      credential: secret,
      body: hook()
    });
    expect(response.status).toBe(acceptedStatus);

    let [item] = await instanceRecords(instance);
    let [agent] = await listEntities(organization.id, 'agent');

    expect(agent).toMatchObject({
      status: 'discovered',
      identifiers: [expect.objectContaining({ type: 'client_family', value: 'claude-code' })]
    });
    expect(item!.record.attribution).toEqual({
      user_id: token.userEntityId,
      device_id: token.deviceEntityId,
      agent_id: agent!.id
    });
  });

  it('creates one ephemeral device per forwarded client address', async () => {
    let { organization, instance, token, secret } = await createToken({
      deviceMode: 'ephemeral'
    });

    let send = (address: string) =>
      ingest('/v1/ingest/hooks/claude-code', {
        credential: secret,
        headers: { 'x-forwarded-for': address },
        body: hook({ prompt: address })
      });

    await send('203.0.113.50');
    await send('203.0.113.50');
    await send('198.51.100.20');

    let devices = await listEntities(organization.id, 'device');
    let ephemeral = devices.filter(device => device.attributes.ephemeral === true);

    expect(ephemeral.map(device => device.attributes.ip).sort()).toEqual([
      '198.51.100.20',
      '203.0.113.50'
    ]);
    expect(ephemeral.every(device => device.status == 'discovered')).toBe(true);
    expect(ephemeral.every(device => device.attributes.tokenId == token.id)).toBe(true);

    let deviceIds = new Set(
      (await instanceRecords(instance)).map(item => item.record.attribution?.device_id)
    );
    expect(deviceIds).toEqual(new Set(ephemeral.map(device => device.id)));
  });

  it('discovers vendor users by email and lets the sync adopt them', async () => {
    let { organization, instance, secret } = await createSource({ family: 'claude-code' });

    let response = await ingest('/v1/logs', {
      credential: secret,
      body: claudeLogs({ 'user.email': 'Vendor.User@Example.com', 'user.id': 'install-1' })
    });
    expect(response.status).toBe(acceptedStatus);

    let users = await agentTracking().entity.list({
      organizationId: organization.id,
      kinds: ['user'],
      statuses: ['discovered']
    });
    let discovered = users.items.find(user =>
      user.identifiers.some(identifier => identifier.value == 'vendor.user@example.com')
    );

    expect(discovered).toBeDefined();

    let [item] = await instanceRecords(instance);
    expect(item!.record.attribution?.user_id).toBe(discovered!.id);
    expect(item!.record.attribution?.client_installation_id).toBeDefined();

    let adopted = await agentTracking().entity.upsert({
      organizationId: organization.id,
      kind: 'user',
      source: 'metorial.consumer',
      ref: 'con_vendor_user',
      identifiers: [{ type: 'email', value: 'vendor.user@example.com' }]
    });

    expect(adopted).toMatchObject({ id: discovered!.id, status: 'managed' });
  });

  it('turns hook git context into a session.context record with repo and workspace', async () => {
    let { organization, instance, secret } = await createToken();

    let response = await ingest('/v1/ingest/hooks/claude-code', {
      credential: secret,
      body: hook({
        hook_event_name: 'SessionStart',
        source: 'startup',
        cwd: '/Users/someone/code/platform',
        metorial: {
          git: {
            remote_url: 'git@github.com:Metorial/Platform.git',
            branch: 'feature/ENG-12-login'
          }
        }
      })
    });
    expect(response.status).toBe(acceptedStatus);

    let items = await instanceRecords(instance);
    let context = items.find(item => item.record.type == 'session.context')!.record;

    expect(context.data).toMatchObject({
      source: 'probe',
      repo: { provider: 'github.com', owner: 'metorial', name: 'platform' },
      branch: 'feature/ENG-12-login',
      ticket_refs: ['ENG-12'],
      workspace: { root_hash: expect.any(String), label: 'platform' }
    });
    expect(context.source.fact_key).toMatch(/^context:/);
    expect(JSON.stringify(items)).not.toContain('/Users/someone');

    let [repo] = await listEntities(organization.id, 'repo');
    let [workspace] = await listEntities(organization.id, 'workspace');

    expect(repo).toMatchObject({ name: 'metorial/platform', status: 'discovered' });
    expect(context.attribution).toMatchObject({
      repo_id: repo!.id,
      workspace_id: workspace!.id
    });
  });
});
