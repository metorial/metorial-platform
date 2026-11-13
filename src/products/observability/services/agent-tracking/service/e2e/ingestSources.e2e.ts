import { uniqueId } from '@lowerdeck/testing-tools';
import { describe, expect, it } from 'vitest';
import {
  acceptedStatus,
  createScope,
  createSource,
  errorCode,
  agentTracking,
  ingest,
  instanceRecords,
  rpcErrorCode
} from './support';

let nowNanos = () => String(BigInt(Date.now()) * 1_000_000n);

let logsBody = (service: string) =>
  JSON.stringify({
    resourceLogs: [
      {
        resource: { attributes: [{ key: 'service.name', value: { stringValue: service } }] },
        scopeLogs: [
          {
            scope: { name: 'com.anthropic.claude_code.events' },
            logRecords: [
              {
                timeUnixNano: nowNanos(),
                body: { stringValue: 'claude_code.user_prompt' },
                attributes: [
                  { key: 'event.name', value: { stringValue: 'user_prompt' } },
                  { key: 'session.id', value: { stringValue: 'session-1' } }
                ]
              }
            ]
          }
        ]
      }
    ]
  });

describe('ingest sources', () => {
  it('creates a source and returns the secret exactly once', async () => {
    let { organization, project, instance, source, secret } = await createSource({
      family: 'cursor',
      tags: [{ key: 'metorial.vendor', value: 'cursor' }],
      newUserLimitPerDay: 25
    });

    expect(source.object).toBe('agent_tracking#ingest_source');
    expect(source.organizationId).toBe(organization.id);
    expect(source.instance).toEqual({
      id: instance.id,
      ref: instance.ref,
      projectId: project.id
    });
    expect(source).toMatchObject({
      family: 'cursor',
      tags: [{ key: 'metorial.vendor', value: 'cursor' }],
      newUserLimitPerDay: 25,
      contentPolicy: { defaultMode: 'basic' },
      revokedAt: null
    });

    expect(secret.startsWith('metorial_agis_')).toBe(true);
    expect(secret).toContain(source.prefix);

    let fetched = await agentTracking().ingestSource.get({
      organizationId: organization.id,
      ingestSourceId: source.id
    });

    expect(JSON.stringify(fetched)).not.toContain(secret);
    expect(Object.keys(fetched)).not.toContain('secret');
    expect(Object.keys(fetched)).not.toContain('secretHash');
  });

  it('authenticates ingest and marks records as coming from the source', async () => {
    let { organization, project, instance, source, secret } = await createSource({
      family: 'claude-code'
    });

    let response = await ingest('/v1/logs', {
      credential: secret,
      body: logsBody('claude-code')
    });

    expect(response.status).toBe(acceptedStatus);

    let items = await instanceRecords(instance);

    expect(items).toHaveLength(1);
    for (let item of items) {
      expect(item.record.ingest).toMatchObject({
        organization_id: organization.id,
        project_id: project.id,
        instance_id: instance.id,
        credential_kind: 'source',
        credential_id: source.id
      });
    }
  });

  it('updates settings and the name', async () => {
    let { organization, source } = await createSource();

    let updated = await agentTracking().ingestSource.update({
      organizationId: organization.id,
      ingestSourceId: source.id,
      name: 'renamed',
      contentPolicy: { defaultMode: 'full' },
      allowedChannels: ['otlp.logs'],
      newUserLimitPerDay: 5
    });

    expect(updated).toMatchObject({
      name: 'renamed',
      contentPolicy: { defaultMode: 'full' },
      allowedChannels: ['otlp.logs'],
      newUserLimitPerDay: 5,
      family: source.family
    });
  });

  it('applies channel restrictions immediately', async () => {
    let { organization, source, secret } = await createSource();

    expect((await ingest('/v1/traces', { credential: secret })).status).toBe(acceptedStatus);

    await agentTracking().ingestSource.update({
      organizationId: organization.id,
      ingestSourceId: source.id,
      allowedChannels: ['otlp.logs']
    });

    let denied = await ingest('/v1/traces', { credential: secret });

    expect(denied.status).toBe(403);
    expect(await errorCode(denied)).toBe('channel_not_allowed');
    expect((await ingest('/v1/logs', { credential: secret })).status).toBe(acceptedStatus);
  });

  it('rotates the secret and stops accepting the old one', async () => {
    let { organization, source, secret } = await createSource();

    expect((await ingest('/v1/logs', { credential: secret })).status).toBe(acceptedStatus);

    let rotated = await agentTracking().ingestSource.rotate({
      organizationId: organization.id,
      ingestSourceId: source.id
    });

    expect(rotated.id).toBe(source.id);
    expect(rotated.secret).not.toBe(secret);
    expect(rotated.prefix).not.toBe(source.prefix);

    let old = await ingest('/v1/logs', { credential: secret });

    expect(old.status).toBe(401);
    expect(await errorCode(old)).toBe('invalid_credential');
    expect((await ingest('/v1/logs', { credential: rotated.secret })).status).toBe(
      acceptedStatus
    );
  });

  it('revokes a source idempotently and refuses changes afterwards', async () => {
    let { organization, source, secret } = await createSource();
    let target = { organizationId: organization.id, ingestSourceId: source.id };

    expect((await ingest('/v1/logs', { credential: secret })).status).toBe(acceptedStatus);

    let revoked = await agentTracking().ingestSource.revoke(target);
    let again = await agentTracking().ingestSource.revoke(target);

    expect(revoked.revokedAt).not.toBeNull();
    expect(again.revokedAt).toEqual(revoked.revokedAt);
    expect((await ingest('/v1/logs', { credential: secret })).status).toBe(401);

    expect(
      await rpcErrorCode(agentTracking().ingestSource.update({ ...target, name: 'x' }))
    ).toBe('precondition_failed');
    expect(await rpcErrorCode(agentTracking().ingestSource.rotate(target))).toBe(
      'precondition_failed'
    );
  });

  it('lists sources by organization and instance', async () => {
    let scope = await createScope();
    let otherInstance = await agentTracking().instance.upsert({
      organizationId: scope.organization.id,
      projectId: scope.project.id,
      ref: uniqueId('inst')
    });

    let first = await createSource({}, scope);
    let second = await createSource({}, scope);
    let elsewhere = await createSource({}, { ...scope, instance: otherInstance });

    let byInstance = await agentTracking().ingestSource.list({
      organizationId: scope.organization.id,
      instanceId: scope.instance.id
    });
    let all = await agentTracking().ingestSource.list({
      organizationId: scope.organization.id
    });

    expect(byInstance.items.map(item => item.id).sort()).toEqual(
      [first.source.id, second.source.id].sort()
    );
    expect(all.items.map(item => item.id).sort()).toEqual(
      [first.source.id, second.source.id, elsewhere.source.id].sort()
    );
  });

  it('rejects invalid input', async () => {
    let scope = await createScope();

    expect(await rpcErrorCode(createSource({ family: '' }, scope))).toBe('invalid_data');
    expect(await rpcErrorCode(createSource({ newUserLimitPerDay: -1 }, scope))).toBe(
      'invalid_data'
    );
    expect(
      await rpcErrorCode(createSource({ tags: [{ key: 'nodot', value: 'x' }] }, scope))
    ).toBe('invalid_data');
  });

  it('keeps sources isolated between organizations', async () => {
    let first = await createSource();
    let second = await createSource();

    let target = { organizationId: second.organization.id, ingestSourceId: first.source.id };

    let codes = await Promise.all([
      rpcErrorCode(agentTracking().ingestSource.get(target)),
      rpcErrorCode(agentTracking().ingestSource.update({ ...target, name: 'hijacked' })),
      rpcErrorCode(agentTracking().ingestSource.rotate(target)),
      rpcErrorCode(agentTracking().ingestSource.revoke(target))
    ]);

    expect(codes).toEqual(['not_found', 'not_found', 'not_found', 'not_found']);
    expect((await ingest('/v1/logs', { credential: first.secret })).status).toBe(
      acceptedStatus
    );
  });
});
