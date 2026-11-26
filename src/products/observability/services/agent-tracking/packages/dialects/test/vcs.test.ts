import { describe, expect, it } from 'vitest';
import { commitDraft, pullRequestDraft } from '../src/vcs';
import { buildDraft } from './build';

let sha = '06de4d4304e317c123c4bbb07394249ed0cde401';

let base = {
  client: { family: 'claude-code' },
  occurredAt: new Date('2026-06-15T11:59:30.000Z'),
  ctx: { sessionId: 'sess-1' }
};

let repo = {
  provider: 'github.com',
  owner: 'example-org',
  name: 'probe-repo',
  url: 'https://github.com/example-org/probe-repo'
};

describe('commitDraft', () => {
  it('keys a commit by session and commit id only', () => {
    let draft = commitDraft(base, {
      source: 'transcript',
      sha: sha.toUpperCase(),
      branch: 'feature/MT-1-x',
      ticketRefs: ['MT-1', 'not a ref', 'MT-1'],
      aiAuthored: true
    });

    expect(draft).toEqual({
      kind: 'event',
      type: 'vcs.commit',
      identity: `vcs.commit|sess-1|${sha}`,
      factKey: `commit:{session_key}:${sha}`,
      occurredAt: base.occurredAt,
      client: base.client,
      ctx: { sessionId: 'sess-1' },
      data: {
        sha,
        branch: 'feature/MT-1-x',
        ticket_refs: ['MT-1'],
        ai_authored: true,
        source: 'transcript'
      }
    });
  });

  it('gives the same fact to the same commit from every channel', () => {
    let draft = commitDraft(base, { source: 'otel', sha })!;

    let logs = buildDraft(
      draft,
      {},
      { adapter: 'claude-code', dialect: 'x', channel: 'otlp.logs' }
    );
    let transcript = buildDraft(
      draft,
      {},
      { adapter: 'claude-code', dialect: 'y', channel: 'transcript' }
    );

    expect(logs.source.fact_key).toBe(transcript.source.fact_key);
    expect(logs.source.fact_key).toBe(`commit:${logs.ctx.session_key}:${sha}`);
    expect(logs.id).not.toBe(transcript.id);
  });

  it('needs a session and a full commit id', () => {
    expect(commitDraft({ ...base, ctx: {} }, { source: 'otel', sha })).toBeNull();

    for (let value of [undefined, '', '06de4d4', 'g'.repeat(40), `${sha}0`]) {
      expect(commitDraft(base, { source: 'otel', sha: value })).toBeNull();
    }

    expect(commitDraft(base, { source: 'otel', sha: 'a'.repeat(64) })?.data).toMatchObject({
      sha: 'a'.repeat(64)
    });
  });
});

describe('pullRequestDraft', () => {
  it('keys a pull request by provider, repository, number and kind', () => {
    let draft = pullRequestDraft(base, {
      source: 'transcript',
      kind: 'opened',
      repo,
      number: 42
    });

    expect(draft).toMatchObject({
      type: 'vcs.pull_request',
      identity: 'vcs.pull_request|sess-1|github.com|example-org/probe-repo#42|opened',
      factKey: 'pr:{session_key}:github.com/example-org/probe-repo#42:opened',
      data: {
        kind: 'opened',
        provider: 'github.com',
        repository: 'example-org/probe-repo',
        number: 42,
        source: 'transcript'
      }
    });
  });

  it('keeps the same pull request on two providers apart', () => {
    let github = pullRequestDraft(base, { source: 'otel', kind: 'opened', repo, number: 1 });
    let gitlab = pullRequestDraft(base, {
      source: 'otel',
      kind: 'opened',
      repo: { ...repo, provider: 'gitlab.com' },
      number: 1
    });

    expect(github!.factKey).not.toBe(gitlab!.factKey);
  });

  it('keeps a linked pull request apart from an opened one', () => {
    let opened = pullRequestDraft(base, { source: 'otel', kind: 'opened', repo, number: 1 });
    let linked = pullRequestDraft(base, { source: 'otel', kind: 'linked', repo, number: 1 });

    expect(opened!.factKey).not.toBe(linked!.factKey);
  });

  it('needs a session and a positive number', () => {
    expect(
      pullRequestDraft(
        { ...base, ctx: {} },
        { source: 'otel', kind: 'opened', repo, number: 1 }
      )
    ).toBeNull();

    for (let number of [0, -1, 1.5, Number.NaN]) {
      expect(
        pullRequestDraft(base, { source: 'otel', kind: 'opened', repo, number })
      ).toBeNull();
    }
  });
});
