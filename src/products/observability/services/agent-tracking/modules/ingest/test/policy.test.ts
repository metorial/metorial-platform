import { describe, expect, it } from 'vitest';
import { dialectManifests, type IngestPolicy } from '@mtsrc/agent-tracking-dialects';
import { principalFixture } from '@mtsrc/agent-tracking-records-model/test/principal';
import type { RecordLane } from '@mtsrc/agent-tracking-spec';
import { allowsDialect, ingestPolicyFor } from '../src/lib/policy';

type Token = 'bound' | 'ephemeral' | 'vendor';

type Case = { token: Token; lane: RecordLane; policy: IngestPolicy };

let tokens: Token[] = ['bound', 'ephemeral', 'vendor'];
let lanes: RecordLane[] = ['live', 'backfill'];
let settings = ['toolDetails', 'sessionContext', 'sessionTitles', 'historyImport'] as const;

let policies = Array.from(
  { length: 2 ** settings.length },
  (_, bits) =>
    Object.fromEntries(
      settings.map((setting, index) => [setting, (bits & (1 << index)) != 0])
    ) as IngestPolicy
);

let principals = {
  bound: principalFixture({ suffix: 'bound' }),
  ephemeral: principalFixture(
    { suffix: 'ephemeral' },
    { binding: { deviceId: undefined, deviceMode: 'ephemeral' } }
  ),
  vendor: principalFixture(
    { suffix: 'vendor' },
    { binding: { userId: undefined, deviceId: undefined, deviceMode: 'vendor' } }
  )
};

let device = (c: Case) => c.token == 'bound';
let liveOrImport = (c: Case) => c.lane == 'live' || c.policy.historyImport;

let hooks = (c: Case) => !device(c);
let desktopContext = (c: Case) => device(c) && c.policy.sessionContext && liveOrImport(c);
let transcript = (c: Case) => device(c) && c.lane == 'backfill' && c.policy.historyImport;
let usage = (c: Case) => device(c) && liveOrImport(c);

let expected: Record<string, (c: Case) => boolean> = {
  'claude-code/hook/claude-code.hooks.v1': hooks,
  'codex/hook/codex.hooks.v1': hooks,
  'claude-code/envelope/metorial.desktop.context.v1': desktopContext,
  'codex/envelope/metorial.desktop.context.v1': desktopContext,
  'cursor/envelope/metorial.desktop.context.v1': desktopContext,
  'antigravity/envelope/metorial.desktop.context.v1': desktopContext,
  'opencode/envelope/metorial.desktop.context.v1': desktopContext,
  'claude-code/transcript/claude-code.transcript.v1': transcript,
  'codex/transcript/codex.transcript.v1': transcript,
  'cursor/hook/cursor.hooks.v1': usage,
  'antigravity/transcript/antigravity.transcript.v1': usage,
  'opencode/sse/opencode.plugin.v1': usage
};

let keyOf = (manifest: (typeof dialectManifests)[number]) =>
  `${manifest.client}/${manifest.channel}/${manifest.dialect}`;

describe('allowsDialect', () => {
  it('has an expectation for every manifest', () => {
    expect(dialectManifests.map(keyOf).sort()).toEqual(Object.keys(expected).sort());
  });

  it.each(dialectManifests.map(manifest => [keyOf(manifest), manifest] as const))(
    '%s follows its rule for every token, lane and setting',
    (key, manifest) => {
      let rule = expected[key]!;
      let mismatches: string[] = [];

      for (let token of tokens) {
        for (let lane of lanes) {
          for (let policy of policies) {
            let c = { token, lane, policy };
            let allowed = allowsDialect({
              principal: principals[token],
              policy,
              manifest,
              lane
            });

            if (allowed != rule(c)) mismatches.push(JSON.stringify(c));
          }
        }
      }

      expect(mismatches).toEqual([]);
    }
  );
});

describe('ingestPolicyFor', () => {
  it('fills the Desktop defaults for a device-bound token', () => {
    let principal = principalFixture(
      { suffix: 'partial' },
      { organization: { settings: { desktop: { sessionTitles: true } } } }
    );

    expect(ingestPolicyFor(principal)).toEqual({
      toolDetails: false,
      sessionContext: true,
      sessionTitles: true,
      historyImport: false
    });
  });

  it('keeps everything for tokens that are not bound to a device', () => {
    let off = {
      toolDetails: false,
      sessionContext: false,
      sessionTitles: false,
      historyImport: false
    };

    for (let token of ['ephemeral', 'vendor'] as const) {
      let principal = {
        ...principals[token],
        organization: { ...principals[token].organization, settings: { desktop: off } }
      };

      expect(ingestPolicyFor(principal)).toEqual({
        toolDetails: true,
        sessionContext: true,
        sessionTitles: true,
        historyImport: true
      });
    }
  });
});
