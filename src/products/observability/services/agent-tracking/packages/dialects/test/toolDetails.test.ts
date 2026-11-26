import { describe, expect, it } from 'vitest';
import { groupOf, logRecord, metricPoint, spanOf } from '@mtsrc/agent-tracking-otlp/test/otlp';
import type { OtlpAttributes, OtlpGroup, OtlpLogRecord } from '@mtsrc/agent-tracking-otlp';
import { readOtlpContext } from '../src/context';
import { buildMapped } from './build';
import { claudeCodeOtlp } from '../src/otlp/claudeCode';
import { codexOtlp } from '../src/otlp/codex';
import { genAiOtlp } from '../src/otlp/genai';
import { mapOtlpGroup } from '../src/registry';
import { fullIngestPolicy } from '@mtsrc/agent-tracking-spec';
import { withOtlpPolicy } from '../src/otlp/policy';
import type { OtlpPolicy } from '../src/types';

let sha = '06de4d4304e317c123c4bbb07394249ed0cde401';

let noToolDetails: OtlpPolicy = { toolDetails: false, sessionContext: true };
let noSessionContext: OtlpPolicy = { toolDetails: true, sessionContext: false };
let neither: OtlpPolicy = { toolDetails: false, sessionContext: false };

let logs = (group: OtlpGroup<OtlpLogRecord>) => group.items.map(item => item.attributes);

let withoutSessionContext = (attributes: OtlpAttributes) =>
  withOtlpPolicy('logs', genAiOtlp, groupOf([logRecord(attributes)]), noSessionContext)
    .items[0]!.attributes;

let claudeLog = (attributes: OtlpAttributes, overrides: Partial<OtlpLogRecord> = {}) =>
  withOtlpPolicy(
    'logs',
    claudeCodeOtlp,
    groupOf([logRecord(attributes, overrides)]),
    noToolDetails
  ).items[0]!.attributes;

let codexLog = (attributes: OtlpAttributes) =>
  withOtlpPolicy('logs', codexOtlp, groupOf([logRecord(attributes)]), noToolDetails).items[0]!
    .attributes;

let claudeBatch = () =>
  groupOf([
    logRecord(
      {
        'event.name': 'tool_result',
        tool_name: 'mcp__github__create_pr',
        tool_parameters: '{"mcp_server_name":"github","full_command":"rm -rf ~"}',
        tool_input: '{"file_path":"/Users/ada/secret.txt"}',
        tool_input_truncated: 'true',
        tool_input_size_bytes: '42',
        error: 'permission denied on /Users/ada',
        'vcs.ref.head.name': 'ada/private',
        success: 'true'
      },
      { body: 'claude_code.tool_result' }
    ),
    logRecord({
      'event.name': 'claude_code.mcp_server_connection',
      server_name: 'github',
      status: 'connected'
    }),
    logRecord({ 'event.name': 'api_error', error: 'overloaded' })
  ]);

let codexBatch = () =>
  groupOf(
    [
      logRecord({
        'event.name': 'codex.tool_result',
        tool_name: 'create_issue',
        tool_namespace: 'mcp__linear__',
        mcp_server: 'linear',
        mcp_server_origin: 'https://mcp.linear.app',
        arguments: '{"command":"cat ~/.ssh/id_rsa"}',
        output: 'secret',
        duration_ms: '12'
      }),
      logRecord({
        'event.name': 'codex.tool_result',
        tool_name: 'shell',
        tool_namespace: 'functions'
      }),
      logRecord({
        'event.name': 'codex.conversation_starts',
        mcp_servers: 'linear,github',
        output: 'anywhere'
      })
    ],
    { 'service.name': 'codex_cli_rs' }
  );

let commitResult = (extra: OtlpAttributes = {}) =>
  logRecord({
    'event.name': 'tool_result',
    tool_name: 'Bash',
    success: 'true',
    tool_parameters: JSON.stringify({
      bash_command: 'git',
      full_command: 'git commit -m "Add notes"',
      git_commit_id: sha,
      git_branch: 'feature/MT-124-second'
    }),
    'vcs.ref.head.name': 'feature/MT-124-second',
    'vcs.ref.head.revision': sha,
    'vcs.ref.head.type': 'branch',
    'vcs.repository.url.full': 'https://github.com/example-org/probe-repo',
    ...extra
  });

describe('tool details at ingest', () => {
  it('takes Claude Code tool details out like Metorial Desktop did, keeping the branch', () => {
    let filtered = withOtlpPolicy('logs', claudeCodeOtlp, claudeBatch(), noToolDetails);
    let sent = JSON.stringify(logs(filtered));

    for (let leaked of ['rm -rf', 'secret.txt', 'github', 'permission denied']) {
      expect(sent).not.toContain(leaked);
    }

    expect(logs(filtered)).toEqual([
      {
        'event.name': 'tool_result',
        tool_name: 'mcp_tool',
        tool_input_size_bytes: '42',
        'vcs.ref.head.name': 'ada/private',
        success: 'true'
      },
      { 'event.name': 'claude_code.mcp_server_connection', status: 'connected' },
      { 'event.name': 'api_error', error: 'overloaded' }
    ]);
  });

  it('takes Codex tool content and MCP names out like Metorial Desktop did', () => {
    let batch = codexBatch();
    let filtered = withOtlpPolicy('logs', codexOtlp, batch, noToolDetails);
    let sent = JSON.stringify(logs(filtered));

    for (let leaked of ['id_rsa', 'secret', 'linear', 'github', 'anywhere', 'create_issue']) {
      expect(sent).not.toContain(leaked);
    }

    expect(logs(filtered)).toEqual([
      {
        'event.name': 'codex.tool_result',
        tool_name: 'mcp_tool',
        tool_namespace: 'mcp',
        duration_ms: '12'
      },
      { 'event.name': 'codex.tool_result', tool_name: 'shell', tool_namespace: 'functions' },
      { 'event.name': 'codex.conversation_starts' }
    ]);
    expect(filtered.items[1]).toEqual(batch.items[1]);
  });

  it('renames a Codex tool whose name carries a namespace', () => {
    let filtered = withOtlpPolicy(
      'logs',
      codexOtlp,
      groupOf([logRecord({ 'event.name': 'codex.tool_result', tool_name: 'probe__echo' })]),
      noToolDetails
    );

    expect(filtered.items[0]!.attributes.tool_name).toBe('mcp_tool');
  });

  it('keeps everything with detailed tool reporting and session context on', () => {
    let claude = claudeBatch();
    let codex = codexBatch();

    expect(withOtlpPolicy('logs', claudeCodeOtlp, claude, fullIngestPolicy)).toBe(claude);
    expect(withOtlpPolicy('logs', codexOtlp, codex, fullIngestPolicy)).toBe(codex);
  });

  it('lifts the commit and branch out of the dropped tool parameters', () => {
    let filtered = withOtlpPolicy(
      'logs',
      claudeCodeOtlp,
      groupOf([commitResult()]),
      noToolDetails
    );
    let attributes = filtered.items[0]!.attributes;

    expect(attributes).toMatchObject({
      git_commit_id: sha,
      git_branch: 'feature/MT-124-second',
      'vcs.ref.head.revision': sha,
      'vcs.ref.head.name': 'feature/MT-124-second',
      'vcs.ref.head.type': 'branch'
    });
    expect(attributes).not.toHaveProperty('tool_parameters');
    expect(JSON.stringify(attributes)).not.toContain('git commit');
  });

  it('lifts nothing from tool parameters that are not a JSON object', () => {
    for (let parameters of ['not json', '["git_commit_id"]', '"x"']) {
      let filtered = withOtlpPolicy(
        'logs',
        claudeCodeOtlp,
        groupOf([logRecord({ 'event.name': 'tool_result', tool_parameters: parameters })]),
        noToolDetails
      );

      expect(filtered.items[0]!.attributes).toEqual({ 'event.name': 'tool_result' });
    }
  });

  it('leaves records without gated attributes untouched', () => {
    let group = groupOf([
      logRecord({ 'event.name': 'api_request', model: 'claude-sonnet', 'session.id': 's1' }),
      logRecord({ 'event.name': 'tool_result', tool_name: 'Read', success: 'true' })
    ]);
    let copy = structuredClone(group);

    for (let policy of [noToolDetails, noSessionContext, neither]) {
      let filtered = withOtlpPolicy('logs', claudeCodeOtlp, group, policy);

      expect(filtered).toEqual(copy);
    }
  });

  it('keeps the records of a group unchanged except for gated attributes', () => {
    let untouched = logRecord({ 'event.name': 'user_prompt', prompt_length: 3 });
    let group = groupOf([untouched, commitResult()]);

    let filtered = withOtlpPolicy('logs', claudeCodeOtlp, group, noToolDetails);

    expect(filtered.items[0]).toEqual(untouched);
    expect(filtered.resource).toBe(group.resource);
  });

  it('takes tool details out of spans and their events', () => {
    let filtered = withOtlpPolicy(
      'traces',
      claudeCodeOtlp,
      groupOf([
        spanOf(
          'claude_code.tool',
          {
            tool_name: 'mcp__probe__echo_word',
            'gen_ai.tool.name': 'echo_word',
            'anthropic.mcp.server.name': 'probe',
            full_command: 'cat ~/.ssh/id_rsa',
            bash_argv0: 'cat',
            bash_command_class: 'read'
          },
          {
            events: [
              {
                timeNs: 1n,
                name: 'tool.output',
                attributes: {
                  tool_input: 'secret',
                  tool_input_original_length: 6,
                  content: 'file text',
                  output: 'mcp output',
                  file_path: '/Users/ada/secret.txt'
                }
              }
            ]
          }
        ),
        spanOf('claude_code.tool.execution', {
          error: 'denied on /Users/ada',
          success: false
        }),
        spanOf('claude_code.tool', { tool_name: 'Bash', 'gen_ai.tool.name': 'Bash' })
      ]),
      noToolDetails
    );

    expect(filtered.items[0]!.attributes).toEqual({
      tool_name: 'mcp_tool',
      bash_command_class: 'read'
    });
    expect(filtered.items[0]!.events[0]!.attributes).toEqual({});
    expect(filtered.items[1]!.attributes).toEqual({ success: false });
    expect(filtered.items[2]!.attributes).toEqual({
      tool_name: 'Bash',
      'gen_ai.tool.name': 'Bash'
    });
  });

  it('takes MCP names out of Codex spans and metrics', () => {
    let traces = withOtlpPolicy(
      'traces',
      codexOtlp,
      groupOf([
        spanOf('mcp.tools.call', {
          'mcp.server.name': 'probe',
          'mcp.server.origin': 'stdio',
          'mcp.connector.id': 'c1',
          'mcp.connector.name': 'Probe',
          'tool.name': 'probe_echo',
          'turn.id': 't1'
        }),
        spanOf('mcp__probeprobe_echo', {
          tool_name: 'probe_echo',
          tool_namespace: 'mcp__probe'
        })
      ]),
      noToolDetails
    );
    let metrics = withOtlpPolicy(
      'metrics',
      codexOtlp,
      groupOf([metricPoint('codex.tool.call', 1, { tool: 'mcp__probeprobe_echo' })]),
      noToolDetails
    );

    expect(traces.items[0]!.attributes).toEqual({ 'tool.name': 'mcp_tool', 'turn.id': 't1' });
    expect(traces.items[1]!.name).toBe('mcp_tool');
    expect(traces.items[1]!.attributes).toEqual({
      tool_name: 'mcp_tool',
      tool_namespace: 'mcp'
    });
    expect(metrics.items[0]!.attributes).toEqual({ tool: 'mcp_tool' });
  });

  it('names a record the way the dialect does', () => {
    let attributes = claudeLog(
      { tool_name: 'Bash', success: 'false', error: 'denied on /Users/ada' },
      { body: 'free text', eventName: 'claude_code.tool_result' }
    );

    expect(attributes).toEqual({ tool_name: 'Bash', success: 'false' });

    let { mapped } = mapOtlpGroup(
      'logs',
      groupOf(
        [
          logRecord(
            { 'session.id': 's1', tool_name: 'Bash', success: 'false', error: 'SENTINEL' },
            { body: 'free text', eventName: 'claude_code.tool_result' }
          )
        ],
        { 'service.name': 'claude-code' }
      ),
      noToolDetails
    );

    expect(mapped[0]!.draft.type).toBe('tool.call');
    expect(JSON.stringify(mapped)).not.toContain('SENTINEL');
  });

  it('sends custom command names as Claude Code does without tool details', () => {
    let named = (command_source: string | undefined) =>
      claudeLog({
        'event.name': 'user_prompt',
        command_name: 'deploy-prod',
        ...(command_source ? { command_source } : {})
      }).command_name;

    expect(named('custom')).toBe('custom');
    expect(named('mcp')).toBe('mcp');
    expect(named(undefined)).toBe('custom');
    expect(
      claudeLog({
        'event.name': 'user_prompt',
        command_name: 'compact',
        command_source: 'builtin'
      }).command_name
    ).toBe('compact');
  });

  it('sends custom agent names as Claude Code does without tool details', () => {
    let completed = (is_built_in?: string | boolean) =>
      claudeLog({
        'event.name': 'subagent_completed',
        agent_type: 'my-reviewer',
        ...(is_built_in !== undefined ? { is_built_in } : {})
      }).agent_type;

    expect(completed('false')).toBe('custom');
    expect(completed(undefined)).toBe('custom');
    expect(completed('true')).toBe('my-reviewer');
    expect(completed(true)).toBe('my-reviewer');

    expect(
      claudeLog({
        'event.name': 'api_request',
        'agent.name': 'Explore',
        query_source: 'agent:builtin:Explore'
      })['agent.name']
    ).toBe('Explore');
    expect(
      claudeLog({
        'event.name': 'api_request',
        'agent.name': 'my-reviewer',
        query_source: 'x'
      })['agent.name']
    ).toBe('custom');
  });

  it('keeps only the event of a hook name and drops matchers and plugin names', () => {
    expect(
      claudeLog({
        'event.name': 'hook_execution_complete',
        hook_event: 'PreToolUse',
        hook_name: 'PreToolUse:mcp__server__tool'
      })
    ).toEqual({
      'event.name': 'hook_execution_complete',
      hook_event: 'PreToolUse',
      hook_name: 'PreToolUse'
    });
    expect(
      claudeLog({
        'event.name': 'hook_registered',
        hook_matcher: 'mcp__server__.*',
        'plugin.name': 'acme-tools',
        'marketplace.name': 'acme',
        hook_event: 'PreToolUse'
      })
    ).toEqual({ 'event.name': 'hook_registered', hook_event: 'PreToolUse' });
  });

  it('takes skill names out of Codex skill invocations', () => {
    let { mapped } = mapOtlpGroup(
      'logs',
      groupOf(
        [
          logRecord({
            'event.name': 'codex.skill_invocation',
            'conversation.id': 'conv-1',
            'skill.name': 'secret-skill',
            'skill.scope': 'user'
          })
        ],
        { 'service.name': 'codex_cli_rs' }
      ),
      noToolDetails
    );

    expect(mapped[0]!.draft.type).toBe('extension.event');
    expect(mapped[0]!.draft.data).toMatchObject({ kind: 'skill', action: 'activated' });
    expect(JSON.stringify(mapped)).not.toContain('secret-skill');
  });

  it('treats a Codex tool with an MCP server as MCP without a namespace', () => {
    expect(
      codexLog({
        'event.name': 'codex.tool_result',
        tool_name: 'create_issue',
        mcp_server: 'linear'
      })
    ).toEqual({ 'event.name': 'codex.tool_result', tool_name: 'mcp_tool' });

    expect(
      codexLog({ 'event.name': 'codex.tool_result', tool_name: 'shell', mcp_server: '' })
    ).toEqual({ 'event.name': 'codex.tool_result', tool_name: 'shell' });
  });

  it('keeps metric points apart that differ only in what was taken out', () => {
    let points = () =>
      groupOf(
        [
          metricPoint('codex.tool.call', 1, {
            tool: 'mcp__linear__create_issue',
            success: 'true'
          }),
          metricPoint('codex.tool.call', 3, {
            tool: 'mcp__github__create_pr',
            success: 'true'
          })
        ],
        { 'service.name': 'codex_cli_rs', 'vcs.repository.url.full': 'https://github.com/a/b' }
      );

    let full = mapOtlpGroup('metrics', points()).mapped;
    let redacted = mapOtlpGroup('metrics', points(), neither).mapped;

    expect(redacted.map(entry => entry.draft.data?.['value'])).toEqual([1, 3]);
    expect(redacted.map(entry => entry.draft.data?.['dims'])).toEqual([
      expect.objectContaining({ tool_name: 'mcp_tool' }),
      expect.objectContaining({ tool_name: 'mcp_tool' })
    ]);
    expect(new Set(redacted.map(entry => entry.draft.identity)).size).toBe(2);
    expect(redacted.map(entry => entry.draft.identity)).toEqual(
      full.map(entry => entry.draft.identity)
    );
    expect(
      JSON.stringify(redacted.map(entry => buildMapped(entry, { route: 'otlp_http' })))
    ).not.toMatch(/linear|github/);
  });

  it('leaves GenAI items without MCP tool names unchanged', () => {
    let group = groupOf([logRecord({ 'event.name': 'x', tool_input: 'kept' })]);

    expect(withOtlpPolicy('logs', genAiOtlp, group, noToolDetails)).toEqual(group);
  });
});

describe('session context at ingest', () => {
  it('drops git and repository attributes from records and the resource', () => {
    let group = groupOf([commitResult({ 'workspace.host_paths': ['/Users/ada/repo'] })], {
      'service.name': 'claude-code',
      'vcs.repository.url.full': 'https://github.com/example-org/probe-repo'
    });

    let filtered = withOtlpPolicy('logs', claudeCodeOtlp, group, noSessionContext);
    let attributes = filtered.items[0]!.attributes;

    expect(filtered.resource.attributes).toEqual({ 'service.name': 'claude-code' });
    expect(Object.keys(attributes).filter(key => key.startsWith('vcs.'))).toEqual([]);
    expect(attributes).not.toHaveProperty('workspace.host_paths');
    expect(JSON.parse(attributes.tool_parameters as string)).toEqual({
      bash_command: 'git',
      full_command: 'git commit -m "Add notes"'
    });
  });

  it('drops the lifted git keys when tool details are off as well', () => {
    let filtered = withOtlpPolicy('logs', claudeCodeOtlp, groupOf([commitResult()]), neither);

    expect(filtered.items[0]!.attributes).toEqual({
      'event.name': 'tool_result',
      tool_name: 'Bash',
      success: 'true'
    });
  });

  it('drops tool parameters it cannot read when they mention git', () => {
    let attributes = withoutSessionContext({
      tool_parameters: '{"git_commit_id":"06de4d4',
      tool_input: 'kept'
    });

    expect(attributes).toEqual({ tool_input: 'kept' });
  });

  it('drops every attribute session context is read from', () => {
    let attributes: OtlpAttributes = {
      'vcs.ref.head.type': 'branch',
      'vcs.ref.head.name': 'main',
      'vcs.ref.head.revision': sha,
      'vcs.repository.url.full': 'https://github.com/a/b',
      'vcs.repository.url': 'https://github.com/a/b',
      'vcs.provider.name': 'github',
      'vcs.owner.name': 'a',
      'vcs.repository.name': 'b',
      'github.copilot.git.repository': 'a/b',
      'github.copilot.git.branch': 'main',
      'github.copilot.git.commit_sha': sha,
      'copilot_chat.repo.remote_url': 'https://github.com/a/b',
      'copilot_chat.repo.head_branch_name': 'main',
      'copilot_chat.repo.head_commit_hash': sha,
      'workspace.host_paths': ['/Users/ada/repo']
    };

    expect(readOtlpContext(attributes).repo).toBeDefined();
    expect(readOtlpContext(withoutSessionContext(attributes))).toEqual({
      root: undefined,
      repo: undefined,
      branch: undefined,
      head: undefined,
      tags: []
    });
  });

  it('produces no session context or commit records', () => {
    let group = groupOf([commitResult({ 'session.id': 'sess-1' })], {
      'service.name': 'claude-code'
    });

    let kept = mapOtlpGroup('logs', group).mapped.map(entry => entry.draft.type);
    let dropped = mapOtlpGroup('logs', group, neither).mapped.map(entry => entry.draft.type);

    expect(kept).toEqual(['tool.call', 'vcs.commit', 'session.context']);
    expect(dropped).toEqual(['tool.call']);
  });
});
