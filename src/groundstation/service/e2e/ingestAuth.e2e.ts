import { describe, expect, it } from 'vitest';
import {
  createToken,
  errorCode,
  groundstation,
  ingest,
  rpcErrorCode,
  acceptedStatus
} from './support';

let unknownToken = `metorial_agit_${'B'.repeat(21)}_${'C'.repeat(43)}`;

describe('ingest authentication', () => {
  it('accepts a valid token as a bearer token or an api key', async () => {
    let { secret } = await createToken();

    let bearer = await ingest('/v1/logs', { credential: secret });
    let apiKey = await ingest('/v1/logs', { headers: { 'x-api-key': secret } });

    expect(bearer.status).toBe(acceptedStatus);
    expect(apiKey.status).toBe(acceptedStatus);
  });

  it('requires a token on every token route', async () => {
    let paths = [
      '/v1/logs',
      '/v1/metrics',
      '/v1/traces',
      '/v1/otlp',
      '/v1/ingest/hooks/claude-code',
      '/v1/bulk'
    ];

    for (let path of paths) {
      let headers: Record<string, string> =
        path == '/v1/bulk' ? { 'content-type': 'application/x-ndjson' } : {};
      let response = await ingest(path, { headers });

      expect(response.status, path).toBe(401);
      expect(response.headers.get('www-authenticate'), path).toContain('Bearer');
      expect(await errorCode(response), path).toBe('missing_credential');
    }
  });

  it('rejects unknown tokens and wrong secrets', async () => {
    let { secret, token } = await createToken();

    let unknown = await ingest('/v1/logs', { credential: unknownToken });
    let wrongSecret = await ingest('/v1/logs', {
      credential: `metorial_agit_${token.prefix}_${'A'.repeat(43)}`
    });
    let malformed = await ingest('/v1/logs', { credential: 'not-a-token' });
    let truncated = await ingest('/v1/logs', { credential: secret.slice(0, -1) });

    for (let response of [unknown, wrongSecret, malformed, truncated]) {
      expect(response.status).toBe(401);
      expect(response.headers.get('www-authenticate')).toContain('Bearer');
      expect(await errorCode(response)).toBe('invalid_credential');
    }
  });

  it('does not reveal why a token was rejected', async () => {
    let { secret, token } = await createToken();

    let wrongSecret = await ingest('/v1/logs', {
      credential: `metorial_agit_${token.prefix}_${'A'.repeat(43)}`
    });
    let unknown = await ingest('/v1/logs', { credential: unknownToken });

    expect(await wrongSecret.json()).toEqual(await unknown.json());
    expect((await ingest('/v1/logs', { credential: secret })).status).toBe(acceptedStatus);
  });

  it('stops accepting a token right after it is revoked, even when cached', async () => {
    let { organization, token, secret } = await createToken();

    expect((await ingest('/v1/logs', { credential: secret })).status).toBe(acceptedStatus);
    expect((await ingest('/v1/logs', { credential: secret })).status).toBe(acceptedStatus);

    await groundstation().ingestToken.revoke({
      organizationId: organization.id,
      ingestTokenId: token.id
    });

    let response = await ingest('/v1/logs', { credential: secret });

    expect(response.status).toBe(401);
    expect(await errorCode(response)).toBe('invalid_credential');
  });

  it('does not let one revoked token affect another of the same instance', async () => {
    let first = await createToken();
    let second = await createToken({}, first);

    await groundstation().ingestToken.revoke({
      organizationId: first.organization.id,
      ingestTokenId: first.token.id
    });

    expect((await ingest('/v1/logs', { credential: first.secret })).status).toBe(401);
    expect((await ingest('/v1/logs', { credential: second.secret })).status).toBe(
      acceptedStatus
    );
  });

  it('stops accepting a token once it expires', async () => {
    let { secret } = await createToken({ expiresAt: new Date(Date.now() + 2000) });

    expect((await ingest('/v1/logs', { credential: secret })).status).toBe(acceptedStatus);

    await expect
      .poll(async () => (await ingest('/v1/logs', { credential: secret })).status, {
        timeout: 10_000,
        interval: 250
      })
      .toBe(401);
  });

  it('applies token updates to cached tokens immediately', async () => {
    let { organization, token, secret } = await createToken();

    expect((await ingest('/v1/ingest/hooks/claude-code', { credential: secret })).status).toBe(
      acceptedStatus
    );

    await groundstation().ingestToken.update({
      organizationId: organization.id,
      ingestTokenId: token.id,
      allowedClients: ['codex']
    });

    let denied = await ingest('/v1/ingest/hooks/claude-code', { credential: secret });

    expect(denied.status).toBe(403);
    expect(await errorCode(denied)).toBe('client_not_allowed');
  });

  it('enforces allowed clients on hook routes', async () => {
    let { secret } = await createToken({ allowedClients: ['codex'] });

    let denied = await ingest('/v1/ingest/hooks/claude-code', { credential: secret });
    let allowed = await ingest('/v1/ingest/hooks/codex', { credential: secret });

    expect(denied.status).toBe(403);
    expect(await errorCode(denied)).toBe('client_not_allowed');
    expect(allowed.status).toBe(acceptedStatus);
  });

  it('enforces allowed channels', async () => {
    let { secret } = await createToken({ allowedChannels: ['otlp.logs'] });

    let traces = await ingest('/v1/traces', { credential: secret });
    let hooks = await ingest('/v1/ingest/hooks/codex', { credential: secret });
    let logs = await ingest('/v1/logs', { credential: secret });

    expect(traces.status).toBe(403);
    expect(await errorCode(traces)).toBe('channel_not_allowed');
    expect(hooks.status).toBe(403);
    expect(logs.status).toBe(acceptedStatus);
  });

  it('checks credentials before the body is read', async () => {
    let response = await ingest('/v1/logs', {
      credential: unknownToken,
      headers: { 'content-encoding': 'gzip' },
      body: 'definitely not gzip'
    });

    expect(response.status).toBe(401);
  });

  it('keeps tokens of different organizations apart', async () => {
    let first = await createToken();
    let second = await createToken();

    await groundstation().instance.upsert({
      organizationId: first.organization.id,
      projectId: first.project.id,
      ref: first.instance.ref,
      skewBoundSeconds: 120
    });

    expect((await ingest('/v1/logs', { credential: first.secret })).status).toBe(
      acceptedStatus
    );
    expect((await ingest('/v1/logs', { credential: second.secret })).status).toBe(
      acceptedStatus
    );

    let code = await rpcErrorCode(
      groundstation().ingestToken.get({
        organizationId: second.organization.id,
        ingestTokenId: first.token.id
      })
    );

    expect(code).toBe('not_found');
  });
});
