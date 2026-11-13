import { describe, expect, it } from 'vitest';
import type { SessionContextData } from '@metorial/groundstation-spec';
import { buildMapped } from '../../test/build';
import { groupOf, logRecord, spanOf } from '../../test/otlp';
import type { OtlpAttributes, OtlpGroup, OtlpSpan } from '../../otlp/model';
import { claudeCodeHooks, codexHooks, createGenericHooks } from '../hooks';
import { hookTime } from '../hooks/tests/fixtures';
import { claudeCodeOtlp } from '../otlp/claudeCode';
import { codexOtlp } from '../otlp/codex';
import { genAiOtlp } from '../otlp/genai';
import { mapOtlpGroup } from '../registry';
import type { Mapped } from '../types';

let hookContext = { identityHint: 'h', occurredAt: hookTime };

let contextOf = (mapped: Mapped[]) =>
  mapped.filter(entry => entry.draft.type == 'session.context');

let dataOf = (entry: Mapped | undefined) =>
  entry?.draft.data as SessionContextData | undefined;

let probeEnvelope = {
  source: 'probe',
  git: {
    toplevel: '/Users/dev/code/platform',
    remote_url: 'git@github.com:Metorial/Platform.git',
    branch: 'feature/ENG-42-login',
    head: 'A1B2C3D4E5F6'
  },
  config: { tags: { team: 'payments' }, tracked: true, modified: false },
  env: { METORIAL_COST_CENTER: 'cc-1', METORIAL_API_KEY: 'nope' },
  resource_attributes: { 'metorial.project': 'checkout', 'service.name': 'x' }
};

describe('hook context', () => {
  it('emits one session.context record on SessionStart with the cwd as a path input', () => {
    let mapped = claudeCodeHooks.map(hookContext, {
      hook_event_name: 'SessionStart',
      session_id: 's-1',
      cwd: '/Users/dev/code/platform/'
    });

    let [context] = contextOf(mapped);

    expect(mapped).toHaveLength(2);
    expect(context?.draft).toMatchObject({
      kind: 'event',
      type: 'session.context',
      ctx: { sessionId: 's-1' },
      data: { source: 'hook' },
      content: [{ role: 'path', value: '/Users/dev/code/platform' }]
    });
    expect(JSON.stringify({ ...context?.draft, content: [], identity: '' })).not.toContain(
      '/Users/dev'
    );
  });

  it('skips events that cannot change the context', () => {
    let mapped = claudeCodeHooks.map(hookContext, {
      hook_event_name: 'PreToolUse',
      session_id: 's-1',
      tool_name: 'Bash',
      cwd: '/Users/dev/code/platform'
    });

    expect(contextOf(mapped)).toHaveLength(0);
  });

  it('needs a session id', () => {
    let mapped = claudeCodeHooks.map(hookContext, {
      hook_event_name: 'SessionStart',
      cwd: '/Users/dev/code/platform'
    });

    expect(contextOf(mapped)).toHaveLength(0);
  });

  it('reads the probe envelope on any event', () => {
    let mapped = codexHooks.map(hookContext, {
      hook_event_name: 'PreToolUse',
      session_id: 's-1',
      tool_name: 'shell',
      cwd: '/Users/dev/code/platform/sub',
      metorial: probeEnvelope
    });

    let [context] = contextOf(mapped);
    let data = dataOf(context);

    expect(data).toMatchObject({
      source: 'probe',
      repo: {
        provider: 'github.com',
        owner: 'metorial',
        name: 'platform',
        url: 'https://github.com/metorial/platform'
      },
      branch: 'feature/ENG-42-login',
      head: 'a1b2c3d4e5f6',
      ticket_refs: ['ENG-42']
    });
    expect(data?.tags).toEqual([
      { k: 'metorial.team', v: 'payments', origin: 'repo' },
      { k: 'metorial.cost_center', v: 'cc-1', origin: 'environment' },
      { k: 'metorial.project', v: 'checkout', origin: 'environment' }
    ]);
    expect(context?.draft.content).toEqual([
      { role: 'path', value: '/Users/dev/code/platform' }
    ]);
  });

  it('carries forked and generation ids on compatible hooks', () => {
    let [start] = claudeCodeHooks.map(hookContext, {
      hook_event_name: 'SessionStart',
      session_id: 's-2',
      previous_session_id: 's-1',
      generation_id: 'gen-1'
    });

    expect(start?.draft.ctx).toMatchObject({
      sessionId: 's-2',
      previousSessionId: 's-1',
      generationId: 'gen-1'
    });
  });

  it('reads cursor workspace roots, parent conversations and generations on generic hooks', () => {
    let mapped = createGenericHooks('cursor').map(hookContext, {
      hook_event_name: 'sessionStart',
      conversation_id: 'conv-2',
      parent_conversation_id: 'conv-1',
      generation_id: 'gen-7',
      user_email: 'Dev@Example.com',
      workspace_roots: ['/Users/dev/code/app', '/Users/dev/code/lib']
    });

    let [event] = mapped.filter(entry => entry.draft.type != 'session.context');
    let [context] = contextOf(mapped);

    expect(event?.draft.ctx).toMatchObject({
      sessionId: 'conv-2',
      parentSessionId: 'conv-1',
      generationId: 'gen-7'
    });
    expect(event?.draft.actor).toEqual({
      user: { email: 'Dev@Example.com' },
      identity_source: 'client_claim'
    });
    expect(context?.draft.content).toEqual([{ role: 'path', value: '/Users/dev/code/app' }]);
  });
});

describe('otlp context', () => {
  let claudeResource: OtlpAttributes = {
    'service.name': 'claude-code',
    'vcs.repository.url.full': 'https://github.com/metorial/platform.git',
    'vcs.ref.head.name': 'ENG-7-fix',
    'vcs.ref.head.type': 'branch',
    'vcs.ref.head.revision': 'abcdef1234567'
  };

  it('reads vcs resource attributes on claude code logs', () => {
    let result = mapOtlpGroup(
      'logs',
      groupOf(
        [logRecord({ 'event.name': 'user_prompt', 'session.id': 's-1', prompt_length: 3 })],
        claudeResource
      )
    );

    let [context] = contextOf(result.mapped);

    expect(result.dialect).toBe(claudeCodeOtlp);
    expect(dataOf(context)).toEqual({
      source: 'otel',
      repo: {
        provider: 'github.com',
        owner: 'metorial',
        name: 'platform',
        url: 'https://github.com/metorial/platform'
      },
      branch: 'ENG-7-fix',
      head: 'abcdef1234567',
      ticket_refs: ['ENG-7']
    });
  });

  it('ignores tag refs as branches', () => {
    let result = mapOtlpGroup(
      'logs',
      groupOf([logRecord({ 'event.name': 'user_prompt', 'session.id': 's-1' })], {
        ...claudeResource,
        'vcs.ref.head.type': 'tag'
      })
    );

    expect(dataOf(contextOf(result.mapped)[0])?.branch).toBeUndefined();
  });

  it('maps the claude code install id and account separately', () => {
    let result = mapOtlpGroup(
      'logs',
      groupOf(
        [
          logRecord({
            'event.name': 'user_prompt',
            'session.id': 's-1',
            'user.id': 'install-1',
            'user.account_uuid': 'acct-1',
            'user.email': 'dev@example.com',
            'organization.id': 'org-1'
          })
        ],
        { 'service.name': 'claude-code' }
      )
    );

    expect(result.mapped[0]?.draft.actor).toEqual({
      install_id: 'install-1',
      user: { id: 'acct-1', email: 'dev@example.com' },
      org_claim: 'org-1',
      identity_source: 'client_claim'
    });
  });

  it('carries the codex parent conversation', () => {
    let result = mapOtlpGroup(
      'logs',
      groupOf(
        [
          logRecord({
            'event.name': 'codex.user_prompt',
            'conversation.id': 'c-2',
            'parent.conversation.id': 'c-1'
          })
        ],
        { 'service.name': 'codex_cli_rs' }
      )
    );

    expect(result.dialect).toBe(codexOtlp);
    expect(result.mapped[0]?.draft.ctx).toMatchObject({
      sessionId: 'c-2',
      parentSessionId: 'c-1'
    });
  });

  it('reads copilot git attributes on gen_ai spans', () => {
    let result = mapOtlpGroup(
      'traces',
      groupOf(
        [
          spanOf('chat gpt-4o', {
            'gen_ai.operation.name': 'chat',
            'gen_ai.conversation.id': 'conv-1',
            'github.copilot.git.repository': 'Metorial/Platform',
            'github.copilot.git.branch': 'main',
            'github.copilot.git.commit_sha': '0123456789abcdef'
          })
        ],
        { 'service.name': 'copilot-chat' }
      ) as OtlpGroup<OtlpSpan>
    );

    expect(result.dialect).toBe(genAiOtlp);
    expect(dataOf(contextOf(result.mapped)[0])).toMatchObject({
      source: 'otel',
      repo: { provider: 'github.com', owner: 'metorial', name: 'platform' },
      branch: 'main',
      head: '0123456789abcdef'
    });
  });

  it('does not emit context without any', () => {
    let result = mapOtlpGroup(
      'logs',
      groupOf([logRecord({ 'event.name': 'user_prompt', 'session.id': 's-1' })], {
        'service.name': 'claude-code'
      })
    );

    expect(contextOf(result.mapped)).toHaveLength(0);
  });

  it('builds a context record whose workspace is hashed', () => {
    let result = mapOtlpGroup(
      'traces',
      groupOf(
        [
          spanOf('chat gpt-4o', {
            'gen_ai.operation.name': 'chat',
            'gen_ai.conversation.id': 'conv-1',
            'workspace.host_paths': ['/home/dev/app']
          })
        ],
        { 'service.name': 'my-agent' }
      ) as OtlpGroup<OtlpSpan>
    );

    let record = buildMapped(contextOf(result.mapped)[0]!);

    expect((record.data as SessionContextData).workspace?.root_hash).toMatch(/^[0-9a-f]{32}$/);
    expect(JSON.stringify({ ...record, content: [] })).not.toContain('/home/dev');
  });
});
