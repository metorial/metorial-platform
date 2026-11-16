import { describe, expect, it } from 'vitest';
import {
  createReviewTools,
  createReviewWorkspace,
  createRunState,
  defineReport,
  deserializeWorkspace,
  EvidenceLedger,
  ReportDraft
} from '../src';

let report = defineReport<{ summary?: { text: string }; evidence?: { refs: any[] } }>({
  sections: {
    summary: {
      description: 'Summary',
      shape: '{ text: string }',
      validate: value => {
        let text = (value as any)?.text;
        return typeof text == 'string' && text.length > 0
          ? { value: { text }, errors: [] }
          : { errors: ['text must be a non-empty string'] };
      }
    },
    evidence: {
      description: 'Evidence',
      shape: '{ refs: LedgerRef[] }',
      validate: (value, ctx) => {
        let refs = (value as any)?.refs ?? [];
        let errors = refs.map((ref: any) => ctx.ledger.check(ref)).filter(Boolean);
        return errors.length ? { errors } : { value: { refs }, errors: [] };
      }
    }
  },
  validateReport: current => (current.summary ? [] : ['summary is required'])
});

let execTool = async (tool: any, input: any) =>
  await tool.execute(input, { toolCallId: 'test', messages: [] });

describe('workspace', () => {
  it('keeps evidence, history and report read-only', async () => {
    let workspace = await createReviewWorkspace({
      evidence: { '/src/index.ts': 'export let x = 1;\n' },
      history: { '/1/report.json': '{}' }
    });

    let read = await workspace.exec('cat /evidence/src/index.ts');
    expect(read.stdout).toContain('export let x = 1;');

    for (let path of ['/evidence/new.txt', '/history/new.txt', '/report/new.txt']) {
      let result = await workspace.exec(`echo hi > ${path}`);
      expect(result.exitCode).not.toBe(0);
    }

    let write = await workspace.exec('echo notes > /workspace/notes.md && cat notes.md');
    expect(write.stdout.trim()).toBe('notes');
  });

  it('round-trips only the workspace mount', async () => {
    let workspace = await createReviewWorkspace({
      evidence: { '/a.txt': 'evidence' },
      history: {}
    });
    await workspace.exec('mkdir -p /workspace/deep && echo kept > /workspace/deep/file.txt');

    let files = deserializeWorkspace(await workspace.serializeWorkspace());
    expect(Object.keys(files)).toEqual(['/deep/file.txt']);
    expect(Buffer.from(files['/deep/file.txt']!).toString()).toBe('kept\n');
  });
});

describe('ledger', () => {
  it('checks references against recorded evidence', () => {
    let ledger = new EvidenceLedger();
    ledger.addFile('src/index.ts', 'a\nb\nc');
    ledger.addUrl('https://example.com/docs#intro', 'hash');
    ledger.addTool('list_issues');

    expect(ledger.check({ type: 'file', path: '/src/index.ts', lines: [1, 3] })).toBeNull();
    expect(ledger.check({ type: 'file', path: '/src/index.ts', lines: [2, 9] })).toContain(
      'out of range'
    );
    expect(ledger.check({ type: 'file', path: '/missing.ts' })).toContain('not part');
    expect(ledger.check({ type: 'url', url: 'https://example.com/docs' })).toBeNull();
    expect(ledger.check({ type: 'url', url: 'https://other.com' })).toContain('not fetched');
    expect(ledger.check({ type: 'tool', key: 'list_issues' })).toBeNull();
    expect(ledger.check({ type: 'fact', id: 'nope' })).toContain('does not exist');
  });
});

describe('report draft', () => {
  it('rejects invalid sections and keeps valid ones', () => {
    let ledger = new EvidenceLedger();
    let draft = new ReportDraft(report);

    expect(draft.writeSection('nope', {}, { ledger }).errors[0]).toContain('Unknown section');
    expect(draft.writeSection('summary', { text: '' }, { ledger }).errors).toHaveLength(1);
    expect(draft.writeSection('summary', { text: 'ok' }, { ledger }).errors).toHaveLength(0);
    expect(draft.current.summary).toEqual({ text: 'ok' });
  });
});

describe('tools', () => {
  it('accepts a section sent as a JSON-encoded string', async () => {
    let written: string[] = [];
    let tools = createReviewTools({
      workspace: await createReviewWorkspace({ evidence: {}, history: {} }),
      ledger: new EvidenceLedger(),
      draft: new ReportDraft(report),
      state: createRunState(),
      stages: ['collecting'],
      hooks: { onSectionWritten: async d => void written.push(d.section) }
    });

    let encoded = await execTool(tools.write_section, {
      section: 'summary',
      value: JSON.stringify({ text: 'fine' })
    });
    expect(encoded.ok).toBe(true);
    expect(written).toEqual(['summary']);

    let plain = await execTool(tools.write_section, {
      section: 'summary',
      value: 'just text'
    });
    expect(plain.ok).toBe(false);
  });

  it('counts fix rounds until the report validates', async () => {
    let ledger = new EvidenceLedger();
    let draft = new ReportDraft(report);
    let state = createRunState();
    let written: string[] = [];

    let tools = createReviewTools({
      workspace: await createReviewWorkspace({ evidence: {}, history: {} }),
      ledger,
      draft,
      state,
      stages: ['collecting'],
      hooks: { onSectionWritten: async d => void written.push(d.section) }
    });

    let first = await execTool(tools.submit, {});
    expect(first.ok).toBe(false);
    expect(state.fixRounds).toBe(1);

    let bad = await execTool(tools.write_section, {
      section: 'evidence',
      value: { refs: [{ type: 'tool', key: 'ghost' }] }
    });
    expect(bad.ok).toBe(false);

    await execTool(tools.write_section, { section: 'summary', value: { text: 'fine' } });
    expect(written).toEqual(['summary']);

    let second = await execTool(tools.submit, {});
    expect(second.ok).toBe(true);
    expect(state.submitted).toBe(true);
  });
});

describe('conclude_recheck', () => {
  let createTools = async (d: { recheck: boolean }) => {
    let ledger = new EvidenceLedger();
    ledger.addFile('/evidence/README.md', 'a\nb');
    let state = createRunState();

    let tools = createReviewTools({
      workspace: await createReviewWorkspace({
        evidence: { '/README.md': 'a\nb' },
        history: {}
      }),
      ledger,
      draft: new ReportDraft(report),
      state,
      stages: ['collecting'],
      recheck: d.recheck,
      web: {
        search: async () => [],
        fetch: async url => ({ url, markdown: 'vendor page' })
      },
      hooks: {}
    });

    return { tools, state };
  };

  it('is only offered for re-checks', async () => {
    let { tools } = await createTools({ recheck: false });

    expect(tools.conclude_recheck).toBeUndefined();
  });

  it('rejects an unchanged conclusion without sources', async () => {
    let { tools, state } = await createTools({ recheck: true });

    let result = await execTool(tools.conclude_recheck, {
      outcome: 'unchanged',
      summary: 'Nothing changed',
      checked: []
    });

    expect(result.ok).toBe(false);
    expect(state.recheck).toBeNull();
  });

  it('only accepts urls that were fetched during this run', async () => {
    let { tools, state } = await createTools({ recheck: true });
    let conclusion = {
      outcome: 'unchanged',
      summary: 'Nothing changed',
      checked: [{ source: 'https://vendor.example/docs', note: 'Same content' }]
    };

    expect((await execTool(tools.conclude_recheck, conclusion)).ok).toBe(false);

    await execTool(tools.fetch_url, { url: 'https://vendor.example/docs' });

    expect((await execTool(tools.conclude_recheck, conclusion)).ok).toBe(true);
    expect(state.recheck?.outcome).toBe('unchanged');
  });

  it('accepts a changed conclusion without sources', async () => {
    let { tools, state } = await createTools({ recheck: true });

    let result = await execTool(tools.conclude_recheck, {
      outcome: 'changed',
      summary: 'New tools were added',
      checked: []
    });

    expect(result.ok).toBe(true);
    expect(state.recheck?.outcome).toBe('changed');
  });
});
