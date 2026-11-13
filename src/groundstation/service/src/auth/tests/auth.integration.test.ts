import { beforeEach, describe, expect, it } from 'vitest';
import { ingestFetch } from '../../ingest';
import {
  ingestSourceService,
  ingestTokenService,
  instanceService,
  organizationService,
  projectService
} from '../../services';
import { eventually, expectServiceError, sleep } from '../../test/helpers';
import { createTestScope } from '../../test/scope';
import { cleanDatabase, testDb } from '../../test/setup';
import { parseIngestCredential } from '../tokenSecret';
import { verifyIngestCredential } from '../verify';

let createToken = async (
  input: Partial<Parameters<typeof ingestTokenService.createIngestToken>[0]['input']> = {}
) => {
  let scope = await createTestScope();

  let created = await ingestTokenService.createIngestToken({
    organization: scope.organization,
    instance: scope.instance,
    input: { name: 'laptop', userRef: 'consumer_1', deviceRef: 'device_1', ...input }
  });

  return { ...scope, ...created };
};

let createSource = async () => {
  let scope = await createTestScope();

  let created = await ingestSourceService.createIngestSource({
    organization: scope.organization,
    instance: scope.instance,
    input: { name: 'Cursor', family: 'cursor', newUserLimitPerDay: 10 }
  });

  return { ...scope, ...created };
};

let ingest = (
  path: string,
  credential: string | undefined,
  headers: Record<string, string> = {}
) =>
  ingestFetch(
    new Request(`http://localhost${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(credential ? { authorization: `Bearer ${credential}` } : {}),
        ...headers
      },
      body: '{}'
    })
  );

describe('ingest credential verification', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('resolves a token principal with its scope, binding and policy', async () => {
    let { organization, project, instance, ingestToken, secret } = await createToken({
      agentRef: 'client_1',
      tags: [{ key: 'metorial.project', value: 'billing' }],
      contentPolicy: { defaultMode: 'shape', roles: { prompt: 'full' } },
      limits: { itemsPerSecond: 50 },
      allowedClients: ['claude-code'],
      allowedChannels: ['hook']
    });

    let principal = await verifyIngestCredential(secret);

    expect(principal).toEqual({
      credential: { kind: 'token', id: ingestToken.id },
      contentPolicy: { defaultMode: 'shape', roles: { prompt: 'full' } },
      limits: { itemsPerSecond: 50 },
      allowedClients: ['claude-code'],
      allowedChannels: ['hook'],
      tags: [{ key: 'metorial.project', value: 'billing' }],
      binding: {
        userId: ingestToken.userEntity.id,
        deviceId: ingestToken.deviceEntity!.id,
        deviceMode: 'bound',
        agentId: ingestToken.agentEntity!.id
      },
      organization: {
        id: organization.id,
        ref: organization.ref,
        hashKeyVersion: 1,
        contentKeyVersion: 1,
        settings: {}
      },
      project: { id: project.id, ref: project.ref },
      instance: {
        id: instance.id,
        ref: instance.ref,
        skewBoundSeconds: 86400,
        backfillMaxAgeDays: null,
        recordRetentionDays: 90,
        contentRetentionDays: 30,
        usageRetentionDays: 400,
        settings: {}
      }
    });
    expect(principal.binding.userId).toMatch(/^gen_/);
  });

  it('resolves an ephemeral token without a device', async () => {
    let { secret } = await createToken({ deviceRef: undefined, deviceMode: 'ephemeral' });

    let principal = await verifyIngestCredential(secret);

    expect(principal.binding.deviceMode).toBe('ephemeral');
    expect(principal.binding.deviceId).toBeUndefined();
    expect(principal.binding.userId).toMatch(/^gen_/);
  });

  it('resolves a source principal as a vendor credential', async () => {
    let { instance, ingestSource, secret } = await createSource();

    let principal = await verifyIngestCredential(secret);

    expect(principal.credential).toEqual({
      kind: 'source',
      id: ingestSource.id,
      family: 'cursor'
    });
    expect(principal.binding).toEqual({ deviceMode: 'vendor' });
    expect(principal.newUserLimitPerDay).toBe(10);
    expect(principal.instance.id).toBe(instance.id);
  });

  it('does not accept a source secret under the token prefix or the reverse', async () => {
    let token = await createToken();
    let source = await createSource();

    let tokenAsSource = token.secret.replace('metorial_agit_', 'metorial_agis_');
    let sourceAsToken = source.secret.replace('metorial_agis_', 'metorial_agit_');

    await expectServiceError(verifyIngestCredential(tokenAsSource), 'invalid_credential');
    await expectServiceError(verifyIngestCredential(sourceAsToken), 'invalid_credential');
  });

  it('rejects unknown tokens, wrong secrets and missing credentials', async () => {
    let { ingestToken, secret } = await createToken();
    let { prefix } = parseIngestCredential(secret)!;

    let wrongSecret = `metorial_agit_${prefix}_${'A'.repeat(43)}`;
    let unknown = `metorial_agit_${'B'.repeat(11)}_${'C'.repeat(43)}`;

    await expectServiceError(verifyIngestCredential(wrongSecret), 'invalid_credential');
    await expectServiceError(verifyIngestCredential(unknown), 'invalid_credential');
    await expectServiceError(verifyIngestCredential(undefined), 'missing_credential');

    expect(ingestToken.prefix).toBe(prefix);
    await expect(verifyIngestCredential(secret)).resolves.toBeDefined();
  });

  it('stops accepting a token right after it is revoked, even when cached', async () => {
    let { ingestToken, secret } = await createToken();

    await verifyIngestCredential(secret);
    await verifyIngestCredential(secret);

    await ingestTokenService.revokeIngestToken({ ingestToken });

    await expectServiceError(verifyIngestCredential(secret), 'invalid_credential');
  });

  it('stops accepting a source after rotation and revocation', async () => {
    let { ingestSource, secret } = await createSource();

    await verifyIngestCredential(secret);

    let rotated = await ingestSourceService.rotateIngestSource({ ingestSource });

    await expectServiceError(verifyIngestCredential(secret), 'invalid_credential');
    await expect(verifyIngestCredential(rotated.secret)).resolves.toBeDefined();

    await ingestSourceService.revokeIngestSource({ ingestSource: rotated.ingestSource });

    await expectServiceError(verifyIngestCredential(rotated.secret), 'invalid_credential');
  });

  it('stops accepting a token once it expires', async () => {
    let { secret } = await createToken({ expiresAt: new Date(Date.now() + 1500) });

    await expect(verifyIngestCredential(secret)).resolves.toBeDefined();

    await sleep(1700);

    await expectServiceError(verifyIngestCredential(secret), 'invalid_credential');
  });

  it.each(['organization', 'project', 'instance'] as const)(
    'stops accepting credentials of an archived %s, even when cached',
    async scope => {
      let token = await createToken();
      let source = await createSource();

      await verifyIngestCredential(token.secret);
      await verifyIngestCredential(source.secret);

      for (let target of [token, source]) {
        if (scope == 'organization') {
          await organizationService.archiveOrganization({ organization: target.organization });
        } else if (scope == 'project') {
          await projectService.archiveProject({ project: target.project });
        } else {
          await instanceService.archiveInstance({ instance: target.instance });
        }
      }

      await expectServiceError(verifyIngestCredential(token.secret), 'invalid_credential');
      await expectServiceError(verifyIngestCredential(source.secret), 'invalid_credential');
    }
  );

  it('applies token updates immediately', async () => {
    let { instance, ingestToken, secret } = await createToken();

    expect((await verifyIngestCredential(secret)).contentPolicy.defaultMode).toBe('basic');

    await ingestTokenService.updateIngestToken({
      ingestToken,
      input: { contentPolicy: { defaultMode: 'full' }, allowedClients: ['codex'] }
    });

    let principal = await verifyIngestCredential(secret);

    expect(principal.contentPolicy.defaultMode).toBe('full');
    expect(principal.allowedClients).toEqual(['codex']);
    expect(principal.instance.id).toBe(instance.id);
  });

  it('applies scope changes to cached credentials', async () => {
    let { organization, project, instance, secret } = await createToken();

    let before = await verifyIngestCredential(secret);
    expect(before.instance.skewBoundSeconds).toBe(86400);
    expect(before.instance.recordRetentionDays).toBe(90);

    await instanceService.upsertInstance({
      organization,
      project,
      input: { ref: instance.ref, skewBoundSeconds: 120 }
    });
    expect((await verifyIngestCredential(secret)).instance.skewBoundSeconds).toBe(120);

    await projectService.upsertProject({
      organization,
      input: { ref: project.ref, recordRetentionDays: 7 }
    });
    expect((await verifyIngestCredential(secret)).instance.recordRetentionDays).toBe(7);

    await organizationService.upsertOrganization({
      input: { ref: organization.ref, settings: { allowedEmailDomains: ['acme.com'] } }
    });
    expect((await verifyIngestCredential(secret)).organization.settings).toEqual({
      allowedEmailDomains: ['acme.com']
    });
  });

  it('records last use without blocking the request', async () => {
    let { ingestToken, secret } = await createToken();
    let source = await createSource();

    expect(ingestToken.lastUsedAt).toBeNull();

    await verifyIngestCredential(secret);
    await verifyIngestCredential(source.secret);

    await eventually(async () => {
      let storedToken = await testDb.ingestToken.findUniqueOrThrow({
        where: { id: ingestToken.id }
      });
      let storedSource = await testDb.ingestSource.findUniqueOrThrow({
        where: { id: source.ingestSource.id }
      });

      expect(storedToken.lastUsedAt).toBeInstanceOf(Date);
      expect(storedSource.lastUsedAt).toBeInstanceOf(Date);
    });
  });
});

describe('authenticated ingest routes', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('lets a valid token through to the handler', async () => {
    let { secret } = await createToken();

    expect((await ingest('/v1/logs', secret)).status).toBe(200);
    expect((await ingest('/v1/logs', undefined, { 'x-api-key': secret })).status).toBe(200);
  });

  it('lets a valid source through to the handler', async () => {
    let { secret } = await createSource();

    expect((await ingest('/v1/logs', secret)).status).toBe(200);
  });

  it('answers 401 with a challenge for bad credentials', async () => {
    let { ingestToken, secret } = await createToken();

    let unknown = await ingest(
      '/v1/logs',
      `metorial_agit_${'B'.repeat(11)}_${'C'.repeat(43)}`
    );

    expect(unknown.status).toBe(401);
    expect(unknown.headers.get('www-authenticate')).toContain('Bearer');

    await ingestTokenService.revokeIngestToken({ ingestToken });

    expect((await ingest('/v1/logs', secret)).status).toBe(401);
  });

  it('keeps ping and the dialect list public', async () => {
    let ping = await ingestFetch(new Request('http://localhost/ping'));
    let dialects = await ingestFetch(new Request('http://localhost/v1/bulk/dialects'));

    expect(ping.status).toBe(200);
    expect(dialects.status).toBe(200);
  });

  it('enforces allowed clients on hook routes', async () => {
    let { secret } = await createToken({ allowedClients: ['codex'] });

    let denied = await ingest('/v1/ingest/hooks/claude-code', secret);
    let body = (await denied.json()) as { code: string };

    expect(denied.status).toBe(403);
    expect(body.code).toBe('client_not_allowed');
    expect((await ingest('/v1/ingest/hooks/codex', secret)).status).toBe(200);
  });

  it('enforces allowed channels', async () => {
    let { secret } = await createToken({ allowedChannels: ['otlp.logs'] });

    let denied = await ingest('/v1/traces', secret);
    let body = (await denied.json()) as { code: string };

    expect(denied.status).toBe(403);
    expect(body.code).toBe('channel_not_allowed');
    expect((await ingest('/v1/logs', secret)).status).toBe(200);
    expect((await ingest('/v1/ingest/hooks/codex', secret)).status).toBe(403);
  });
});
