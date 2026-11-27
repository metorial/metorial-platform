import { describe, expect, it } from 'vitest';
import type { SessionContextData } from '@mtsrc/agent-tracking-spec';
import { sessionKey } from '@mtsrc/agent-tracking-crypto';
import { rootHash } from '@mtsrc/agent-tracking-records-model';
import { readOtlpContext } from '../../src/context';
import { desktopContext } from '../../src/envelope/desktop';
import { bulkHarness, policyWith, unitOrganizationKey, unitPrincipal } from '../build';

let sha = '06de4d4304e317c123c4bbb07394249ed0cde401';
let workspaceKey = '9f86d081884c7d659a2feaa0c55ad015';

let policy = policyWith({ sessionContext: true });

let { build } = bulkHarness(desktopContext, {
  identityHint: 'desktop|session:s-1|1',
  client: 'codex',
  clientVersion: '0.63.0',
  observedAt: new Date('2026-06-15T11:59:00Z'),
  policy
});

let sessionContext = (overrides: Record<string, unknown> = {}) => ({
  kind: 'session_context',
  session_id: 's-1',
  remote_url: 'git@github.com:Acme/API.git',
  branch: 'ivan/mt-365-title',
  head: sha.toUpperCase(),
  default_branch: 'main',
  worktree: true,
  sub_path: 'services/api/',
  workspace_key: workspaceKey,
  permission_mode: 'acceptEdits',
  title: 'Fix the login flow',
  entrypoint: 'cli',
  ...overrides
});

describe('the Desktop context dialect', () => {
  describe('session_context', () => {
    it('maps the context of a session', () => {
      let [record, ...rest] = build(sessionContext({ parent_session_id: 's-0' }));
      let principal = unitPrincipal();

      expect(rest).toEqual([]);
      expect(record).toMatchObject({
        type: 'session.context',
        source: { adapter: 'metorial-desktop', dialect: 'metorial.desktop.context.v1' },
        client: { family: 'codex', version: '0.63.0', surface: 'cli' },
        occurred_at: '2026-06-15T11:59:00.000Z',
        ctx: {
          session_id: 's-1',
          parent_session_key: sessionKey(
            unitOrganizationKey(principal),
            principal.instance.id,
            'codex',
            's-0'
          )
        },
        content: []
      });
      expect(record!.source.channel).toBe('envelope');
      expect(record!.data).toEqual({
        source: 'probe',
        repo: {
          provider: 'github.com',
          owner: 'acme',
          name: 'api',
          url: 'https://github.com/acme/api'
        },
        branch: 'ivan/mt-365-title',
        head: sha,
        default_branch: 'main',
        worktree: true,
        sub_path: 'services/api',
        permission_mode: 'acceptEdits',
        ticket_refs: ['MT-365'],
        workspace: {
          root_hash: rootHash(
            unitOrganizationKey(principal),
            principal.binding.deviceId!,
            `key:${workspaceKey}`
          ),
          label: 'api'
        }
      } satisfies SessionContextData);
      expect(JSON.stringify(record)).not.toContain(workspaceKey);
    });

    it('keys the session like the OTel dialect of the same client', () => {
      let principal = unitPrincipal();

      for (let client of ['claude-code', 'codex']) {
        let [record] = build(sessionContext(), { client });

        expect(record!.ctx.session_key).toBe(
          sessionKey(unitOrganizationKey(principal), principal.instance.id, client, 's-1')
        );
      }
    });

    it('drops the title unless session titles are on', () => {
      let [hidden] = build(sessionContext());
      let [shown] = build(sessionContext(), {
        policy: { ...policy, sessionTitles: true }
      });

      expect(hidden!.data).not.toHaveProperty('title');
      expect(hidden!.quality.dropped).toContain('payload.title');
      expect(JSON.stringify(hidden)).not.toContain('Fix the login flow');
      expect((shown!.data as SessionContextData).title).toBe('Fix the login flow');
    });

    it.each([
      'git@github.com:acme/api.git',
      'ssh://git@github.com/acme/api.git',
      'https://github.com/acme/api',
      'https://github.com/Acme/API.git'
    ])('derives the same repository as OTel from %s', remote => {
      let [record] = build(sessionContext({ remote_url: remote }));
      let otel = readOtlpContext({
        'vcs.repository.url.full': 'https://github.com/acme/api.git'
      });
      let parts = readOtlpContext({
        'vcs.provider.name': 'github',
        'vcs.owner.name': 'acme',
        'vcs.repository.name': 'api'
      });

      expect((record!.data as SessionContextData).repo).toEqual(otel.repo);
      expect(otel.repo).toEqual(parts.repo);
    });

    it('marks a remote it cannot read as dropped and keeps the rest', () => {
      let [record] = build(sessionContext({ remote_url: 'not-a-remote' }));

      expect(record!.data).not.toHaveProperty('repo');
      expect(record!.quality.dropped).toContain('payload.remote_url');
      expect((record!.data as SessionContextData).branch).toBe('ivan/mt-365-title');
    });

    it('maps nothing when only the title was sent and titles are off', () => {
      expect(build({ kind: 'session_context', session_id: 's-1', title: 'x' })).toEqual([]);
    });

    it('applies a parent link or an entrypoint sent alone', () => {
      let principal = unitPrincipal();
      let [parent] = build({
        kind: 'session_context',
        session_id: 's-1',
        parent_session_id: 's-0'
      });
      let [surface] = build({
        kind: 'session_context',
        session_id: 's-1',
        entrypoint: 'vscode'
      });

      expect(parent).toMatchObject({
        type: 'session.context',
        data: { source: 'probe' },
        ctx: {
          parent_session_key: sessionKey(
            unitOrganizationKey(principal),
            principal.instance.id,
            'codex',
            's-0'
          )
        }
      });
      expect(surface).toMatchObject({ client: { surface: 'ide' }, data: { source: 'probe' } });
      expect(parent!.id).not.toBe(surface!.id);
    });

    it('gives a resent context the same record id and a new parent a new one', () => {
      let [first] = build(sessionContext());
      let [again] = build(sessionContext(), {
        identityHint: 'desktop|session:s-1|9',
        observedAt: new Date('2026-06-15T11:59:30Z')
      });
      let [parented] = build(sessionContext({ parent_session_id: 's-0' }));

      expect(again!.id).toBe(first!.id);
      expect(parented!.id).not.toBe(first!.id);
    });
  });

  describe('commit', () => {
    let commit = (overrides: Record<string, unknown> = {}) => ({
      kind: 'commit',
      session_id: 's-1',
      sha,
      branch: 'ivan/mt-365-title',
      committed_at: '2026-06-15T13:58:00+02:00',
      ticket_refs: ['mt-365', '#42', 'utf-8', 'fix-1'],
      ai_authored: true,
      ...overrides
    });

    it('maps a commit at the time it was observed, without its message', () => {
      let [record] = build(commit());

      expect(record).toMatchObject({
        type: 'vcs.commit',
        occurred_at: '2026-06-15T11:59:00.000Z',
        client: { family: 'codex', version: '0.63.0' },
        data: {
          sha,
          branch: 'ivan/mt-365-title',
          committed_at: '2026-06-15T11:58:00.000Z',
          ticket_refs: ['MT-365', '#42', 'FIX-1'],
          ai_authored: true,
          source: 'probe'
        }
      });
      expect(record!.source.fact_key).toBe(`commit:${record!.ctx.session_key}:${sha}`);
    });

    it('ignores pull request numbers on a commit', () => {
      let [record] = build(commit({ pr_numbers: [42] }));

      expect(record!.data).not.toHaveProperty('pr_numbers');
      expect(JSON.stringify(record)).not.toContain('42,');
    });

    it('keeps an old committer date out of the record time', () => {
      let [record] = build(commit({ committed_at: '2016-01-01T00:00:00Z' }));

      expect(record!.occurred_at).toBe('2026-06-15T11:59:00.000Z');
      expect(record!.data.committed_at).toBe('2016-01-01T00:00:00.000Z');
    });

    it('gives a resent commit the same record id', () => {
      let [first] = build(commit());
      let [again] = build(commit(), { identityHint: 'other' });

      expect(again!.id).toBe(first!.id);
    });
  });

  describe('pull_request', () => {
    let pullRequest = (overrides: Record<string, unknown> = {}) => ({
      kind: 'pull_request',
      session_id: 's-1',
      relation: 'opened',
      provider: 'github',
      repository: 'Acme/API',
      number: 7,
      ...overrides
    });

    it('maps an opened pull request and never stores a link from the device', () => {
      let [record] = build(pullRequest({ url: 'https://user:token@evil.example/x' }));

      expect(record).toMatchObject({ type: 'vcs.pull_request' });
      expect(record!.data).toEqual({
        kind: 'opened',
        provider: 'github.com',
        repository: 'acme/api',
        number: 7,
        source: 'probe'
      });
      expect(JSON.stringify(record)).not.toContain('evil');
      expect(record!.source.fact_key).toBe(
        `pr:${record!.ctx.session_key}:github.com/acme/api#7:opened`
      );
    });

    it('keeps the same pull request on two hosts apart', () => {
      let [github] = build(pullRequest());
      let [gitlab] = build(pullRequest({ provider: 'gitlab' }));

      expect(github!.source.fact_key).not.toBe(gitlab!.source.fact_key);
      expect(github!.id).not.toBe(gitlab!.id);
    });

    it('keeps nested owners, host providers and linked pull requests', () => {
      let [record] = build(
        pullRequest({
          relation: 'linked',
          provider: 'gitlab.com',
          repository: 'group/sub/app'
        })
      );

      expect(record!.data).toEqual({
        kind: 'linked',
        provider: 'gitlab.com',
        repository: 'group/sub/app',
        number: 7,
        source: 'probe'
      });
    });
  });

  describe('session_stats', () => {
    it('maps running line totals as a cumulative code change', () => {
      let [record] = build({
        kind: 'session_stats',
        session_id: 's-1',
        lines_added: 120,
        lines_removed: 30
      });

      expect(record).toMatchObject({
        type: 'code.change',
        occurred_at: '2026-06-15T11:59:00.000Z',
        data: { lines: { added: 120, removed: 30 }, cumulative: true, source: 'probe' }
      });
    });

    it('keeps the id of a resent total and separates a new one', () => {
      let stats = { kind: 'session_stats', session_id: 's-1', lines_added: 5 };

      let [first] = build(stats);
      let [again] = build(stats, { identityHint: 'other' });
      let [grown] = build({ ...stats, lines_added: 6 });

      expect(again!.id).toBe(first!.id);
      expect(grown!.id).not.toBe(first!.id);
    });
  });

  describe('validation', () => {
    let pullRequest = (overrides: Record<string, unknown>) => ({
      kind: 'pull_request',
      session_id: 's-1',
      relation: 'opened',
      provider: 'github',
      repository: 'a/b',
      number: 1,
      ...overrides
    });

    it.each([
      [{ kind: 'session_title', session_id: 's-1' }, 'kind', 'invalid_enum'],
      [{ kind: 'session_context' }, 'session_id', 'invalid_type'],
      [{ kind: 'session_context', session_id: '' }, 'session_id', 'invalid_regex'],
      [{ kind: 'session_context', session_id: 'has space' }, 'session_id', 'invalid_regex'],
      [sessionContext({ head: 'abc123' }), 'head', 'invalid_regex'],
      [sessionContext({ sub_path: '/abs/path' }), 'sub_path', 'invalid_regex'],
      [sessionContext({ sub_path: 'a/../b' }), 'sub_path', 'invalid_regex'],
      [sessionContext({ sub_path: '..' }), 'sub_path', 'invalid_regex'],
      [sessionContext({ sub_path: 'C:/dev' }), 'sub_path', 'invalid_regex'],
      [sessionContext({ sub_path: 'a\\b' }), 'sub_path', 'invalid_regex'],
      [sessionContext({ sub_path: 'a/\u202eb' }), 'sub_path', 'invalid_characters'],
      [sessionContext({ workspace_key: 'abc' }), 'workspace_key', 'invalid_regex'],
      [sessionContext({ workspace_key: 'z'.repeat(32) }), 'workspace_key', 'invalid_regex'],
      [sessionContext({ worktree: 'yes' }), 'worktree', 'invalid_type'],
      [sessionContext({ branch: 'a\nb' }), 'branch', 'invalid_characters'],
      [sessionContext({ branch: 'a\u0085b' }), 'branch', 'invalid_characters'],
      [
        sessionContext({ default_branch: 'ma\u2066in' }),
        'default_branch',
        'invalid_characters'
      ],
      [sessionContext({ title: 't'.repeat(257) }), 'title', 'invalid_length'],
      [sessionContext({ title: 'Fix \u202Egol' }), 'title', 'invalid_characters'],
      [sessionContext({ remote_url: 'has space' }), 'remote_url', 'invalid_regex'],
      [
        sessionContext({ remote_url: 'https://gïthub.com/a/b' }),
        'remote_url',
        'invalid_regex'
      ],
      [{ kind: 'commit', session_id: 's-1', sha: 'abc' }, 'sha', 'invalid_regex'],
      [
        { kind: 'commit', session_id: 's-1', sha, ticket_refs: 'MT-1' },
        'ticket_refs',
        'invalid_type'
      ],
      [
        {
          kind: 'commit',
          session_id: 's-1',
          sha,
          ticket_refs: Array.from({ length: 9 }, (_, i) => `MT-${i + 1}`)
        },
        'ticket_refs',
        'invalid_max_length'
      ],
      [
        { kind: 'commit', session_id: 's-1', sha, ticket_refs: ['not a ref'] },
        'ticket_refs',
        'invalid_regex'
      ],
      [
        { kind: 'commit', session_id: 's-1', sha, ticket_refs: [' MT-1'] },
        'ticket_refs',
        'invalid_regex'
      ],
      [sessionContext({ branch: 'a\u200bb' }), 'branch', 'invalid_characters'],
      [sessionContext({ title: 'Fix\u2028it' }), 'title', 'invalid_characters'],
      [sessionContext({ title: '\ufeffFix' }), 'title', 'invalid_characters'],
      [pullRequest({ number: '7' }), 'number', 'invalid_type'],
      [pullRequest({ number: 0 }), 'number', 'invalid_min'],
      [
        { kind: 'commit', session_id: 's-1', sha, committed_at: 'today' },
        'committed_at',
        'invalid_timestamp'
      ],
      [
        { kind: 'commit', session_id: 's-1', sha, committed_at: '2026-13-45T00:00:00Z' },
        'committed_at',
        'invalid_timestamp'
      ],
      [
        { kind: 'commit', session_id: 's-1', sha, committed_at: '1999-01-01T00:00:00Z' },
        'committed_at',
        'invalid_timestamp'
      ],
      [pullRequest({ relation: 'merged' }), 'relation', 'invalid_enum'],
      [pullRequest({ repository: 'just-a-name' }), 'repository', 'invalid_regex'],
      [pullRequest({ repository: 'acme/..' }), 'repository', 'invalid_regex'],
      [pullRequest({ repository: './api' }), 'repository', 'invalid_regex'],
      [pullRequest({ repository: `acme/${'a'.repeat(129)}` }), 'repository', 'invalid_regex'],
      [pullRequest({ provider: 'localhost' }), 'provider', 'invalid_regex'],
      [pullRequest({ provider: 'evil' }), 'provider', 'invalid_regex'],
      [pullRequest({ provider: '-x.com' }), 'provider', 'invalid_regex'],
      [{ kind: 'session_stats', session_id: 's-1' }, 'lines_added', 'required'],
      [
        { kind: 'session_stats', session_id: 's-1', lines_added: -1 },
        'lines_added',
        'invalid_min'
      ],
      [
        { kind: 'session_stats', session_id: 's-1', lines_removed: 1.5 },
        'lines_removed',
        'invalid_integer'
      ],
      [
        { kind: 'session_stats', session_id: 's-1', lines_added: '12abc' },
        'lines_added',
        'invalid_type'
      ]
    ])('rejects %j at %s', (payload, path, code) => {
      let result = desktopContext.check!(payload);

      let error = !result.success ? result.errors[0] : undefined;

      expect(result.success).toBe(false);
      expect([error?.path?.[0], error?.code]).toEqual([path, code]);
    });

    it('accepts known provider names and hosts', () => {
      for (let provider of ['github', 'GitLab', 'azure_devops', 'git.example.co.uk']) {
        expect(desktopContext.check!(pullRequest({ provider })).success).toBe(true);
      }
    });

    it('ignores fields it does not know', () => {
      let [record] = build(sessionContext({ cwd: '/Users/dev/api', message: 'secret' }));

      expect(JSON.stringify(record)).not.toMatch(/Users|secret/);
    });
  });
});
