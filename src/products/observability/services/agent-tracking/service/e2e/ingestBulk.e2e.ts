import { describe, expect, it } from 'vitest';
import {
  bulk,
  bulkHeader,
  createHookToken,
  createScope,
  createToken,
  desktopItem,
  errorCode,
  ingest,
  instanceRecords,
  ndjson,
  setSinkBusy
} from './support';

let header = bulkHeader;

let item = (seq: number, overrides: Record<string, unknown> = {}) => ({
  client: 'claude-code',
  channel: 'hook',
  dialect: 'claude-code.hooks.v1',
  source: { kind: 'transcript', ref: 'file-1', seq },
  observed_at: new Date().toISOString(),
  payload: { hook_event_name: 'UserPromptSubmit', session_id: 'session-1', prompt: `p${seq}` },
  ...overrides
});

let daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

let sha = '06de4d4304e317c123c4bbb07394249ed0cde401';

let desktopBatch = () => [
  desktopItem(1, {
    kind: 'session_context',
    remote_url: 'git@github.com:acme/api.git',
    branch: 'ivan/mt-365-title',
    workspace_key: 'ab'.repeat(16),
    title: 'SENTINEL title'
  }),
  desktopItem(2, { kind: 'commit', sha, ticket_refs: ['eng-9'] }),
  desktopItem(3, {
    kind: 'pull_request',
    relation: 'opened',
    provider: 'github',
    repository: 'acme/api',
    number: 7
  }),
  desktopItem(4, { kind: 'session_stats', lines_added: 10, lines_removed: 2 })
];

describe('bulk ingest', () => {
  it('stores accepted items and reports counts', async () => {
    let { instance, secret } = await createHookToken();

    let response = await bulk(secret, ndjson(header(), item(1), item(2), item(3)));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      batch_id: 'batch-1',
      accepted: 3,
      rejected: 0,
      rejections: []
    });

    let items = await instanceRecords(instance, 'live');

    expect(items).toHaveLength(3);
    expect(items.every(entry => entry.record.ingest.route == 'bulk')).toBe(true);
    expect(items[0]!.record.ingest.agent).toMatchObject({ name: 'metorial-desktop' });
  });

  it('routes backfill batches to the backfill lane with event time from the item', async () => {
    let { instance, secret } = await createHookToken();
    let observedAt = daysAgo(2);

    let response = await bulk(
      secret,
      ndjson(header({ mode: 'backfill' }), item(1, { observed_at: observedAt }))
    );

    expect(response.status).toBe(200);
    expect(await instanceRecords(instance, 'live')).toHaveLength(0);

    let [stored] = await instanceRecords(instance, 'backfill');

    expect(stored!.record.ingest.backfill).toBe(true);
    expect(new Date(stored!.record.occurred_at).toISOString()).toBe(observedAt);
  });

  it('rejects backfill items without observed_at, from the future, or too old', async () => {
    let { instance, secret } = await createHookToken(
      {},
      await createScope({ instance: { backfillMaxAgeDays: 30, skewBoundSeconds: 300 } })
    );

    let { observed_at: _removed, ...withoutTime } = item(1);

    let response = await bulk(
      secret,
      ndjson(
        header({ mode: 'backfill' }),
        withoutTime,
        item(2, { observed_at: new Date(Date.now() + 7 * 86_400_000).toISOString() }),
        item(3, { observed_at: daysAgo(60) }),
        item(4, { observed_at: daysAgo(1) })
      )
    );

    let body = (await response.json()) as {
      accepted: number;
      rejected: number;
      rejections: { i: number; code: string }[];
    };

    expect(body.accepted).toBe(1);
    expect(body.rejected).toBe(3);
    expect(body.rejections.map(r => [r.i, r.code])).toEqual([
      [0, 'parse_error'],
      [1, 'parse_error'],
      [2, 'too_old']
    ]);
    expect(await instanceRecords(instance, 'backfill')).toHaveLength(1);
  });

  it('reports item-level rejections with their line index', async () => {
    let { instance, secret } = await createHookToken({ allowedClients: ['claude-code'] });

    let response = await bulk(
      secret,
      ndjson(
        header(),
        item(1),
        'not json',
        item(2, { client: 'codex', dialect: 'codex.hooks.v1' }),
        item(3, { dialect: 'nope.v1' }),
        item(4, { client: 'Bad Client!' }),
        item(6)
      )
    );

    let body = (await response.json()) as {
      accepted: number;
      rejected: number;
      rejections: { i: number; code: string }[];
    };

    expect(body.accepted).toBe(2);

    let codes = Object.fromEntries(body.rejections.map(r => [r.i, r.code]));

    expect(codes[1]).toBe('parse_error');
    expect(codes[2]).toBe('not_allowed');
    expect(codes[3]).toBe('unknown_dialect');
    expect(codes[4]).toBe('unknown_client');
    expect(await instanceRecords(instance)).toHaveLength(2);
  });

  it('is idempotent when a batch is resent', async () => {
    let { instance, secret } = await createHookToken();
    let body = ndjson(header(), item(1), item(2));

    await bulk(secret, body);
    await bulk(secret, body);

    let items = await instanceRecords(instance);
    let ids = new Set(items.map(entry => entry.record.id));

    expect(ids.size).toBe(2);
  });

  it('rejects an invalid header and stores nothing', async () => {
    let { instance, secret } = await createHookToken();

    for (let body of [
      '',
      'not json\n',
      ndjson(header({ batch_id: '' }), item(1)),
      ndjson(header({ mode: 'weird' }), item(1)),
      ndjson(header({ sent_at: 'yesterday' }), item(1)),
      ndjson(item(1))
    ]) {
      let response = await bulk(secret, body);

      expect(response.status, body).toBe(400);
      expect(await errorCode(response), body).toBe('invalid_batch_header');
    }

    expect(await instanceRecords(instance)).toHaveLength(0);
  });

  it('answers 503 and stores nothing when the sink is busy', async () => {
    let { instance, secret } = await createHookToken();

    await setSinkBusy(true);

    try {
      let response = await bulk(secret, ndjson(header(), item(1), item(2)));

      expect(response.status).toBe(503);
      expect(response.headers.get('retry-after')).toBe('5');
    } finally {
      await setSinkBusy(false);
    }

    expect(await instanceRecords(instance)).toHaveLength(0);

    let retry = await bulk(secret, ndjson(header(), item(1), item(2)));

    expect(retry.status).toBe(200);
    expect(await instanceRecords(instance)).toHaveLength(2);
  });

  it('rejects unauthenticated requests', async () => {
    let response = await bulk('metorial_agit_invalid', ndjson(header(), item(1)));

    expect(response.status).toBe(401);
  });

  it('lists supported dialects without authentication', async () => {
    let response = await ingest('/v1/bulk/dialects', { method: 'GET' });

    expect(response.status).toBe(200);

    let body = (await response.json()) as {
      object: string;
      items: { client: string; channel: string; dialect: string }[];
    };

    expect(body.object).toBe('agent_tracking#bulk_dialects');
    expect(body.items.map(entry => entry.dialect)).toEqual(
      expect.arrayContaining([
        'claude-code.hooks.v1',
        'codex.hooks.v1',
        'metorial.desktop.context.v1',
        'claude-code.transcript.v1',
        'codex.transcript.v1',
        'cursor.hooks.v1',
        'antigravity.transcript.v1',
        'opencode.plugin.v1'
      ])
    );
  });

  it('stores Desktop context from a device-bound token', async () => {
    let { instance, secret } = await createToken();

    let response = await bulk(secret, ndjson(header(), ...desktopBatch()));

    expect(await response.json()).toEqual({
      batch_id: 'batch-1',
      accepted: 4,
      rejected: 0,
      rejections: []
    });

    let records = (await instanceRecords(instance)).map(entry => entry.record);

    expect(records.map(record => record.type).sort()).toEqual([
      'code.change',
      'session.context',
      'vcs.commit',
      'vcs.pull_request'
    ]);
    expect(records.find(record => record.type == 'session.context')!.data).toMatchObject({
      source: 'probe',
      repo: { provider: 'github.com', owner: 'acme', name: 'api' },
      branch: 'ivan/mt-365-title',
      ticket_refs: ['MT-365'],
      workspace: { root_hash: expect.any(String) }
    });
    expect(JSON.stringify(records)).not.toMatch(/SENTINEL|abababab/);

    await bulk(secret, ndjson(header({ batch_id: 'batch-2' }), ...desktopBatch()));

    let ids = new Set((await instanceRecords(instance)).map(entry => entry.record.id));
    expect(ids.size).toBe(4);
  });

  it('rejects Desktop context while it is off or from tokens not bound to a device', async () => {
    let off = await createToken(
      {},
      await createScope({ organization: { settings: { desktop: { sessionContext: false } } } })
    );
    let ephemeral = await createToken({ deviceMode: 'ephemeral' });

    for (let target of [off, ephemeral]) {
      let response = await bulk(target.secret, ndjson(header(), ...desktopBatch()));
      let body = (await response.json()) as {
        accepted: number;
        rejections: { i: number; code: string }[];
      };

      expect(body.accepted).toBe(0);
      expect(body.rejections).toEqual([0, 1, 2, 3].map(i => ({ i, code: 'not_allowed' })));
      expect(await instanceRecords(target.instance)).toHaveLength(0);
    }
  });

  it('refuses the Claude Code and Codex hook dialects from a device-bound token', async () => {
    let { instance, secret } = await createToken();

    let response = await bulk(
      secret,
      ndjson(header(), item(1), item(2, { client: 'codex', dialect: 'codex.hooks.v1' }))
    );

    expect(await response.json()).toMatchObject({
      accepted: 0,
      rejections: [
        { i: 0, code: 'not_allowed' },
        { i: 1, code: 'not_allowed' }
      ]
    });
    expect(await instanceRecords(instance)).toHaveLength(0);
  });

  it('accepts Desktop history only while History Import is on', async () => {
    let off = await createToken();
    let on = await createToken(
      {},
      await createScope({ organization: { settings: { desktop: { historyImport: true } } } })
    );
    let backfill = () =>
      ndjson(
        header({ mode: 'backfill' }),
        ...desktopBatch().map(entry => ({ ...entry, observed_at: daysAgo(1) }))
      );

    let rejected = (await (await bulk(off.secret, backfill())).json()) as {
      accepted: number;
      rejections: { code: string }[];
    };

    expect(rejected.accepted).toBe(0);
    expect(rejected.rejections.every(rejection => rejection.code == 'not_allowed')).toBe(true);

    expect(await (await bulk(on.secret, backfill())).json()).toMatchObject({
      accepted: 4,
      rejected: 0
    });
    expect(await instanceRecords(on.instance, 'backfill')).toHaveLength(4);
  });

  it('accepts transcript usage only in backfill batches while History Import is on', async () => {
    let off = await createToken();
    let on = await createToken(
      {},
      await createScope({ organization: { settings: { desktop: { historyImport: true } } } })
    );
    let transcriptItems = () => [
      {
        client: 'claude-code',
        channel: 'transcript',
        dialect: 'claude-code.transcript.v1',
        source: { kind: 'desktop', ref: 'session:hist-1', seq: 1 },
        observed_at: daysAgo(1),
        payload: {
          kind: 'request',
          session_id: 'hist-1',
          message_id: 'msg_1',
          request_id: 'req_1',
          model: 'claude-opus-5-5',
          input_tokens: 2,
          output_tokens: 790,
          cache_read_input_tokens: 14623,
          cache_creation_input_tokens: 20634
        }
      },
      {
        client: 'codex',
        channel: 'transcript',
        dialect: 'codex.transcript.v1',
        source: { kind: 'desktop', ref: 'session:thread-1', seq: 1 },
        observed_at: daysAgo(1),
        payload: {
          kind: 'request',
          session_id: 'thread-1',
          cumulative_total_tokens: 1000,
          model: 'gpt-6-luna',
          input_tokens: 900,
          cached_input_tokens: 600,
          output_tokens: 100
        }
      }
    ];

    let rejected = (await (
      await bulk(off.secret, ndjson(header({ mode: 'backfill' }), ...transcriptItems()))
    ).json()) as { accepted: number; rejections: { code: string }[] };
    let live = (await (
      await bulk(on.secret, ndjson(header(), ...transcriptItems()))
    ).json()) as {
      accepted: number;
      rejections: { code: string }[];
    };

    for (let body of [rejected, live]) {
      expect(body.accepted).toBe(0);
      expect(body.rejections.map(rejection => rejection.code)).toEqual([
        'not_allowed',
        'not_allowed'
      ]);
    }

    expect(
      await (
        await bulk(on.secret, ndjson(header({ mode: 'backfill' }), ...transcriptItems()))
      ).json()
    ).toMatchObject({ accepted: 2, rejected: 0 });

    let records = (await instanceRecords(on.instance, 'backfill')).map(entry => entry.record);

    expect(records.map(record => [record.type, record.source.channel])).toEqual([
      ['model.request', 'transcript'],
      ['model.request', 'transcript']
    ]);
    expect(await instanceRecords(on.instance, 'live')).toHaveLength(0);
  });

  it('marks imported subagent requests and refuses lines older than the import window', async () => {
    let token = await createToken(
      {},
      await createScope({
        organization: { settings: { desktop: { historyImport: true, historyImportDays: 10 } } }
      })
    );
    let request = (seq: number, observedAt: string, purpose?: string) => ({
      client: 'claude-code',
      channel: 'transcript',
      dialect: 'claude-code.transcript.v1',
      source: { kind: 'desktop', ref: 'session:hist-sub', seq },
      observed_at: observedAt,
      payload: {
        kind: 'request',
        session_id: 'hist-sub',
        message_id: `msg_${seq}`,
        request_id: `req_${seq}`,
        model: 'claude-opus-5-5',
        input_tokens: 2,
        output_tokens: 90,
        ...(purpose ? { purpose } : {})
      }
    });

    let body = (await (
      await bulk(
        token.secret,
        ndjson(
          header({ mode: 'backfill' }),
          request(1, daysAgo(5)),
          request(2, daysAgo(5), 'subagent'),
          request(3, daysAgo(11), 'subagent')
        )
      )
    ).json()) as { accepted: number; rejections: { i: number; code: string }[] };

    expect(body.accepted).toBe(2);
    expect(body.rejections).toEqual([{ i: 2, code: 'too_old' }]);

    let records = (await instanceRecords(token.instance, 'backfill')).map(
      entry => entry.record
    );
    expect(records.map(record => record.data.purpose).sort()).toEqual(['main', 'subagent']);
  });

  it('accepts client usage from a device-bound token live, and as history with History Import', async () => {
    let bound = await createToken();
    let history = await createToken(
      {},
      await createScope({ organization: { settings: { desktop: { historyImport: true } } } })
    );
    let ephemeral = await createToken({ deviceMode: 'ephemeral' });

    let usageItems = (observedAt: string) => [
      {
        client: 'cursor',
        channel: 'hook',
        dialect: 'cursor.hooks.v1',
        source: { kind: 'desktop', ref: 'session:conv-1', seq: 1 },
        observed_at: observedAt,
        payload: {
          kind: 'request',
          session_id: 'conv-1',
          generation_id: 'gen-1',
          model: 'composer-2.5',
          input_tokens: 40000,
          output_tokens: 200,
          cache_read_tokens: 30000,
          cache_write_tokens: 0
        }
      },
      {
        client: 'antigravity',
        channel: 'transcript',
        dialect: 'antigravity.transcript.v1',
        source: { kind: 'desktop', ref: 'session:conv-2', seq: 1 },
        observed_at: observedAt,
        payload: {
          kind: 'request',
          session_id: 'conv-2',
          step_index: 4,
          model: 'gemini-4-hydrogen',
          input_tokens: 2500,
          cache_read_tokens: 11000,
          output_tokens: 90
        }
      },
      {
        client: 'opencode',
        channel: 'sse',
        dialect: 'opencode.plugin.v1',
        source: { kind: 'desktop', ref: 'session:ses_1', seq: 1 },
        observed_at: observedAt,
        payload: {
          kind: 'request',
          session_id: 'ses_1',
          message_id: 'msg_1',
          provider: 'anthropic',
          model: 'claude-haiku-5-5',
          input_tokens: 4,
          output_tokens: 99,
          reasoning_tokens: 95,
          cache_write_tokens: 10685,
          cost_usd: 0.0014
        }
      }
    ];

    expect(
      await (await bulk(bound.secret, ndjson(header(), ...usageItems(daysAgo(0))))).json()
    ).toMatchObject({ accepted: 3, rejected: 0 });
    expect(
      await (
        await bulk(
          history.secret,
          ndjson(header({ mode: 'backfill' }), ...usageItems(daysAgo(1)))
        )
      ).json()
    ).toMatchObject({ accepted: 3, rejected: 0 });

    let live = (await instanceRecords(bound.instance, 'live')).map(entry => entry.record);

    expect(live.map(record => [record.client.family, record.source.channel]).sort()).toEqual([
      ['antigravity', 'transcript'],
      ['cursor', 'hook'],
      ['opencode', 'sse']
    ]);
    expect(live.map(record => record.type).sort()).toEqual([
      'model.request',
      'model.request',
      'turn.completed'
    ]);
    expect(await instanceRecords(history.instance, 'backfill')).toHaveLength(3);

    let withoutHistory = (await (
      await bulk(
        bound.secret,
        ndjson(header({ mode: 'backfill', batch_id: 'batch-3' }), ...usageItems(daysAgo(1)))
      )
    ).json()) as { accepted: number; rejections: { code: string }[] };

    expect(withoutHistory.accepted).toBe(0);
    expect(withoutHistory.rejections.map(rejection => rejection.code)).toEqual([
      'not_allowed',
      'not_allowed',
      'not_allowed'
    ]);

    let refused = (await (
      await bulk(ephemeral.secret, ndjson(header(), ...usageItems(daysAgo(0))))
    ).json()) as { accepted: number; rejections: { code: string }[] };

    expect(refused.accepted).toBe(0);
    expect(refused.rejections.map(rejection => rejection.code)).toEqual([
      'not_allowed',
      'not_allowed',
      'not_allowed'
    ]);
  });

  it('keeps batches of different instances apart', async () => {
    let first = await createHookToken();
    let second = await createHookToken();

    await bulk(first.secret, ndjson(header(), item(1), item(2)));
    await bulk(second.secret, ndjson(header(), item(1)));

    expect(await instanceRecords(first.instance)).toHaveLength(2);
    expect(await instanceRecords(second.instance)).toHaveLength(1);
  });

  it('applies detailed tool reporting to hook items from other tokens', async () => {
    let mcpItem = item(1, {
      payload: {
        hook_event_name: 'PostToolUse',
        session_id: 'session-mcp',
        tool_name: 'mcp__github__create_pr',
        tool_use_id: 'toolu_mcp',
        mcp_server: { name: 'github' },
        tool_input: { title: 'SENTINEL-e2e-bulk' }
      }
    });

    let tokenFor = async (toolDetails: boolean) =>
      createHookToken(
        { contentPolicy: { defaultMode: 'full' } },
        await createScope({
          organization: { settings: { desktop: { toolDetails } } },
          instance: { settings: { contentPolicy: { defaultMode: 'full' } } }
        })
      );

    let off = await tokenFor(false);
    let on = await tokenFor(true);

    await bulk(off.secret, ndjson(header(), mcpItem));
    await bulk(on.secret, ndjson(header(), mcpItem));

    let [stripped] = await instanceRecords(off.instance);
    let [kept] = await instanceRecords(on.instance);

    expect(stripped!.record.data.tool).toEqual({
      name: 'mcp_tool',
      kind: 'mcp',
      class: 'mcp'
    });
    expect(JSON.stringify(stripped)).not.toMatch(/SENTINEL|github|create_pr/);
    expect(kept!.record.data.tool).toMatchObject({
      mcp: { server: 'github', tool: 'create_pr' }
    });
    expect(kept!.record.content.some(entry => entry.text?.includes('SENTINEL'))).toBe(true);
  });
});
