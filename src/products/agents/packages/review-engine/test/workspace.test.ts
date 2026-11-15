import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createReviewTools,
  createReviewWorkspace,
  createRunState,
  defineReport,
  EvidenceLedger,
  ReportDraft
} from '../src';

let MIB = 1024 * 1024;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('review shell limits', () => {
  it('rejects large source, output, nested command loops and expansions', async () => {
    let workspace = await createReviewWorkspace({ evidence: {}, history: {} });
    let commands = [
      `echo ${'x'.repeat(256 * 1024)}`,
      'printf "%0300000d" 1',
      "bash -c 'for ((i=0;i<3000;i++)); do :; done'",
      'echo {1..1500}'
    ];

    for (let command of commands) {
      let result = await workspace.exec(command);

      expect(result.exitCode).toBe(126);
      expect(result.stderr).toMatch(/limit|too many/);
    }

    expect((await workspace.exec('echo recovered')).stdout).toBe('recovered\n');
  });

  it('stops a sleeping command at the shell deadline before it can write', async () => {
    let workspace = await createReviewWorkspace({ evidence: {}, history: {} });
    let result = await workspace.exec('sleep 60; echo late > /workspace/late');

    expect(result.exitCode).toBe(124);
    expect(await workspace.fs.exists('/workspace/late')).toBe(false);
  }, 35_000);

  it('keeps scripts usable for ordinary analysis', async () => {
    let workspace = await createReviewWorkspace({
      evidence: {
        '/analyze.sh': "jq -r '.name' /evidence/tool.json | tr '[:lower:]' '[:upper:]'",
        '/tool.json': JSON.stringify({ name: 'list_items' })
      },
      history: {}
    });
    let result = await workspace.exec('bash /evidence/analyze.sh');

    expect(result).toEqual({ exitCode: 0, stdout: 'LIST_ITEMS\n', stderr: '' });
  });

  it('bounds writable base storage outside the persisted workspace', async () => {
    let workspace = await createReviewWorkspace({
      evidence: { '/block': 'x'.repeat(MIB) },
      history: {}
    });
    let result = await workspace.exec(
      'for i in {1..9}; do cp /evidence/block /tmp/block-$i; echo $i >> /tmp/block-$i; done'
    );

    expect(result.stderr).toContain('in-memory filesystem byte limit exceeded');
    expect(await workspace.fs.exists('/workspace/notes')).toBe(false);
    expect((await workspace.exec('echo notes > /workspace/notes')).exitCode).toBe(0);
  });

  it('bounds persisted workspace writes independently of base storage', async () => {
    let workspace = await createReviewWorkspace({ evidence: {}, history: {} });
    await workspace.writeWorkspaceFile('/full', new Uint8Array(32 * MIB));

    let result = await workspace.exec('echo overflow > /workspace/extra');

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('in-memory filesystem byte limit exceeded');
    expect((await workspace.exec('echo temporary > /tmp/note')).exitCode).toBe(0);
  });

  it('bounds evidence, history and report initialization', async () => {
    for (let [mount, bytes] of [
      ['evidence', 16 * MIB],
      ['history', 8 * MIB],
      ['report', 4 * MIB]
    ] as const) {
      await expect(
        createReviewWorkspace({
          evidence: {},
          history: {},
          [mount]: { '/oversized': 'x'.repeat(bytes + 1) }
        })
      ).rejects.toThrow('in-memory filesystem byte limit exceeded');
    }

    let workspace = await createReviewWorkspace({ evidence: {}, history: {} });

    await expect(
      workspace.writeReportFile('/oversized.json', 'x'.repeat(4 * MIB + 1))
    ).rejects.toThrow('in-memory filesystem byte limit exceeded');
  });

  it('limits repeated shell calls across the whole review', async () => {
    let workspace = await createReviewWorkspace({ evidence: {}, history: {} });

    for (let i = 0; i < 512; i++) {
      expect((await workspace.exec(':')).exitCode).toBe(0);
    }

    let result = await workspace.exec('echo late > /workspace/late');

    expect(result.stderr).toContain('command budget exhausted');
    expect(await workspace.fs.exists('/workspace/late')).toBe(false);
  });

  it('does not reset the total execution time budget between shell calls', async () => {
    let workspace = await createReviewWorkspace({ evidence: {}, history: {} });
    vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValue(120_000);

    await workspace.exec(':');
    let result = await workspace.exec('echo late > /workspace/late');

    expect(result.stderr).toContain('execution time budget exhausted');
    expect(await workspace.fs.exists('/workspace/late')).toBe(false);
  });

  it('serializes simultaneous shell calls in the same workspace', async () => {
    let workspace = await createReviewWorkspace({ evidence: {}, history: {} });
    let [, read] = await Promise.all([
      workspace.exec('sleep 0.02; echo ready > /workspace/state'),
      workspace.exec('cat /workspace/state')
    ]);

    expect(read).toEqual({ exitCode: 0, stdout: 'ready\n', stderr: '' });
  });

  it('keeps network access and optional runtimes unavailable', async () => {
    let fetch = vi.fn(() => {
      throw new Error('Unexpected host network access');
    });
    vi.stubGlobal('fetch', fetch);

    let workspace = await createReviewWorkspace({ evidence: {}, history: {} });

    for (let command of [
      'curl https://review.invalid',
      'wget https://review.invalid',
      'python3 --version',
      'js-exec -c 1'
    ]) {
      expect((await workspace.exec(command)).exitCode).not.toBe(0);
    }

    await workspace.exec('echo virtual > /dev/tcp/review.invalid/80');

    expect(await workspace.fs.readFile('/dev/tcp/review.invalid/80', 'utf8')).toBe(
      'virtual\n'
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('review shell cancellation', () => {
  it('cancels an active command and prevents queued writes after review cancellation', async () => {
    let controller = new AbortController();
    let workspace = await createReviewWorkspace({
      evidence: {},
      history: {},
      abortSignal: controller.signal
    });
    let running = workspace.exec('sleep 1; echo late > /workspace/active');
    let queued = workspace.exec('echo late > /workspace/queued');
    let timer = setTimeout(() => controller.abort(), 20);

    try {
      let results = await Promise.all([running, queued]);

      expect(results.every(result => result.exitCode != 0)).toBe(true);
      expect(await workspace.fs.exists('/workspace/active')).toBe(false);
      expect(await workspace.fs.exists('/workspace/queued')).toBe(false);
    } finally {
      clearTimeout(timer);
    }
  });

  it('propagates tool cancellation to the shell without canceling the workspace', async () => {
    let workspace = await createReviewWorkspace({ evidence: {}, history: {} });
    let controller = new AbortController();
    let tools = createReviewTools({
      workspace,
      ledger: new EvidenceLedger(),
      draft: new ReportDraft(defineReport({ sections: {}, validateReport: () => [] })),
      state: createRunState(),
      stages: [],
      hooks: {}
    });
    let running = tools.bash!.execute!(
      { command: 'sleep 1; echo late > /workspace/late' },
      { toolCallId: 'test', messages: [], context: {}, abortSignal: controller.signal }
    );
    let timer = setTimeout(() => controller.abort(), 20);

    try {
      expect(await running).toMatchObject({ exitCode: 124 });
      expect(await workspace.fs.exists('/workspace/late')).toBe(false);
      expect((await workspace.exec('echo recovered')).stdout).toBe('recovered\n');
    } finally {
      clearTimeout(timer);
    }
  });
});
