import { describe, expect, it } from 'vitest';
import type { SessionContextData } from '@mtsrc/agent-tracking-spec';
import { sessionKey } from '@mtsrc/agent-tracking-crypto';
import type { RecordDraft } from '@mtsrc/agent-tracking-records-model';
import { buildDraft, unitOrganizationKey, unitPrincipal } from '../build';
import { sessionContextType } from '@mtsrc/agent-tracking-records-model';
import { normalizeRoot, rootHash } from '@mtsrc/agent-tracking-records-model';

let contextDraft = (overrides: Partial<RecordDraft> = {}): RecordDraft => ({
  kind: 'event',
  type: sessionContextType,
  identity: 'ctx-1',
  client: { family: 'claude-code' },
  ctx: { sessionId: 's-1' },
  data: {
    source: 'hook',
    repo: { provider: 'github.com', owner: 'metorial', name: 'platform' },
    branch: 'ENG-1-x'
  },
  content: [{ role: 'path', value: '/Users/dev/code/platform' }],
  ...overrides
});

describe('normalizeRoot', () => {
  it.each([
    ['/Users/dev/code/platform/', '/Users/dev/code/platform'],
    ['C:\\Users\\dev\\platform', 'c:/Users/dev/platform'],
    ['//srv//repo', '/srv/repo'],
    ['/', '/'],
    ['  /tmp/x\u0000 ', '/tmp/x']
  ])('normalizes %s', (raw, expected) => {
    expect(normalizeRoot(raw)).toBe(expected);
  });

  it('rejects empty and oversized roots', () => {
    expect(normalizeRoot('')).toBeUndefined();
    expect(normalizeRoot(undefined)).toBeUndefined();
    expect(normalizeRoot(`/${'a'.repeat(2000)}`)).toBeUndefined();
  });
});

describe('session.context records', () => {
  it('hashes the root per device and labels it with the repo name', () => {
    let principal = unitPrincipal();
    let record = buildDraft(contextDraft(), { principal });
    let data = record.data as SessionContextData;

    expect(data.workspace).toEqual({
      root_hash: rootHash(
        unitOrganizationKey(principal),
        principal.binding.deviceId!,
        '/Users/dev/code/platform'
      ),
      label: 'platform'
    });
    expect(JSON.stringify({ ...record, content: [] })).not.toContain('/Users/dev');
  });

  it('scopes the root hash to the credential without a bound device', () => {
    let bound = buildDraft(contextDraft());
    let ephemeral = buildDraft(contextDraft(), {
      principal: unitPrincipal({ binding: { deviceId: undefined, deviceMode: 'ephemeral' } })
    });

    expect((ephemeral.data as SessionContextData).workspace?.root_hash).not.toBe(
      (bound.data as SessionContextData).workspace?.root_hash
    );
  });

  it('keeps the path text only when the policy explicitly allows the path role', () => {
    let full = buildDraft(contextDraft(), {
      principal: unitPrincipal({ contentPolicy: { defaultMode: 'full' } })
    });
    let allowed = buildDraft(contextDraft(), {
      principal: unitPrincipal({
        contentPolicy: { defaultMode: 'basic', roles: { path: 'full' } }
      })
    });

    expect(full.content[0]).toMatchObject({ role: 'path' });
    expect(full.content[0]?.text).toBeUndefined();
    expect(allowed.content[0]).toMatchObject({
      role: 'path',
      text: '/Users/dev/code/platform'
    });
  });

  it('keys the fact per session and context, ignoring the reporting source', () => {
    let fromHook = buildDraft(contextDraft());
    let fromOtel = buildDraft(
      contextDraft({
        identity: 'ctx-2',
        data: { ...contextDraft().data, source: 'otel' }
      })
    );
    let otherBranch = buildDraft(
      contextDraft({ data: { ...contextDraft().data, branch: 'main' } })
    );

    expect(fromHook.source.fact_key).toMatch(
      new RegExp(`^context:${fromHook.ctx.session_key}:[0-9a-f]+$`)
    );
    expect(fromOtel.source.fact_key).toBe(fromHook.source.fact_key);
    expect(otherBranch.source.fact_key).not.toBe(fromHook.source.fact_key);
  });

  it('has no fact key without a session', () => {
    expect(buildDraft(contextDraft({ ctx: {} })).source.fact_key).toBeNull();
  });
});

describe('session lineage keys', () => {
  let principal = unitPrincipal();
  let keyOf = (id: string) =>
    sessionKey(unitOrganizationKey(principal), principal.instance.id, 'claude-code', id);

  let draft = (ctx: RecordDraft['ctx']): RecordDraft => ({
    kind: 'event',
    type: 'session.start',
    identity: 'x',
    client: { family: 'claude-code' },
    ctx
  });

  it('derives parent and continues keys like the session key', () => {
    let record = buildDraft(
      draft({ sessionId: 's-2', parentSessionId: 's-1', previousSessionId: 's-0' }),
      { principal }
    );

    expect(record.ctx).toMatchObject({
      session_key: keyOf('s-2'),
      parent_session_key: keyOf('s-1'),
      continues_session_key: keyOf('s-0')
    });
  });

  it('drops self references and keeps the generation id', () => {
    let record = buildDraft(
      draft({
        sessionId: 's-1',
        parentSessionId: 's-1',
        previousSessionId: 's-1',
        generationId: 'gen-9'
      }),
      { principal }
    );

    expect(record.ctx.parent_session_key).toBeUndefined();
    expect(record.ctx.continues_session_key).toBeUndefined();
    expect(record.ctx.generation_id).toBe('gen-9');
  });
});
