import { jsonSchema, tool } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createReviewTools,
  createReviewWorkspace,
  createRunState,
  createSubmissionVerifier,
  defineReport,
  EvidenceLedger,
  ReportDraft,
  runReviewAgent,
  type ReviewModel
} from '../src';

let pricing = {
  inputPerMillion: 1,
  outputPerMillion: 1,
  cacheReadPerMillion: 1,
  cacheWritePerMillion: 0
};

let response = (content: any[]) => ({
  content,
  finishReason: { unified: 'tool-calls' as const, raw: 'tool_calls' },
  usage: {
    inputTokens: { total: 1000, noCache: 1000, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 100, text: 100, reasoning: 0 }
  },
  warnings: []
});

let call = (toolName: string, input = {}, toolCallId = toolName) => ({
  type: 'tool-call',
  toolCallId,
  toolName,
  input: JSON.stringify(input)
});

let definition = defineReport<{ summary: { text: string } }>({
  sections: {
    summary: {
      description: 'Summary',
      shape: '{ text: string }',
      validate: value =>
        typeof (value as any)?.text == 'string'
          ? { value: value as { text: string }, errors: [] }
          : { errors: ['text is required'] }
    }
  },
  validateReport: report => (report.summary ? [] : ['summary is required'])
});

afterEach(() => vi.useRealTimers());

describe('reviewer and verifier cooperation', () => {
  it('preserves context and evidence reads while repairing a rejected submission near the step limit', async () => {
    let state = createRunState();
    let draft = new ReportDraft(definition);
    let judgeCalls = 0;
    let judge = new MockLanguageModelV4({
      doStream: async () => {
        let result = {
          ...response([
            {
              type: 'text',
              text: JSON.stringify(
                ++judgeCalls == 1
                  ? {
                      consistent: false,
                      issues: [
                        {
                          section: 'summary',
                          message:
                            'The source allows deleting the selected file; acknowledge deletion.'
                        }
                      ]
                    }
                  : { consistent: true, issues: [] }
              )
            }
          ]),
          finishReason: { unified: 'stop' as const, raw: 'stop' }
        };
        return {
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue({ type: 'stream-start', warnings: [] });
              controller.enqueue({ type: 'text-start', id: 'text' });
              for (let part of result.content)
                controller.enqueue({ type: 'text-delta', id: 'text', delta: part.text });
              controller.enqueue({ type: 'text-end', id: 'text' });
              controller.enqueue({
                type: 'finish',
                usage: result.usage,
                finishReason: result.finishReason
              });
              controller.close();
            }
          })
        };
      }
    });
    let verificationCost = 0;
    let tools = createReviewTools({
      state,
      draft,
      workspace: await createReviewWorkspace({
        evidence: { 'SKILL.md': 'Delete the file selected by the user.' },
        history: {}
      }),
      ledger: new EvidenceLedger(),
      stages: [],
      hooks: {
        validateSubmission: createSubmissionVerifier({
          model: { slug: 'judge', model: judge, pricing },
          sectionNames: draft.sectionNames,
          reviewInstructions: 'Static review. Expected capabilities affect exposure.',
          prepare: report => ({
            report,
            scores: { security: 95 },
            evidence: { source: 'Delete the file selected by the user.' }
          }),
          onUsage: usage => {
            verificationCost += usage.costMicros;
          }
        })
      }
    });
    let reviewer = new MockLanguageModelV4({
      doGenerate: [
        response([
          call('write_section', { section: 'summary', value: { text: 'Reads only' } })
        ]),
        response([call('submit')]),
        response([call('bash', { command: 'cat /evidence/SKILL.md' })]),
        response([
          call(
            'write_section',
            { section: 'summary', value: { text: 'Deletes the user-selected file' } },
            'corrected'
          )
        ]),
        response([call('submit', {}, 'resubmit')])
      ]
    });

    let result = await runReviewAgent({
      model: { slug: 'reviewer', model: reviewer, pricing },
      system: 'Assess this skill.',
      prompt: 'Review the skill, retaining this original context.',
      state,
      tools,
      maxSteps: 5,
      maxCostMicros: 100_000,
      maxFixRounds: 2,
      extraCostMicros: () => verificationCost
    });

    expect(result.outcome).toBe('submitted');
    expect(state.submitted).toBe(true);
    expect(state.lastErrors).toEqual([]);
    expect(draft.current.summary?.text).toBe('Deletes the user-selected file');
    expect(judgeCalls).toBe(2);
    expect(result.usage.costMicros + verificationCost).toBe(7700);
    let lastPrompt = JSON.stringify(reviewer.doGenerateCalls.at(-1)?.prompt);
    expect(lastPrompt).toContain('retaining this original context');
    expect(lastPrompt).toContain('acknowledge deletion');
    expect(lastPrompt).toContain('Delete the file selected by the user.');
    expect(lastPrompt).not.toContain('NoSuchToolError');
  });

  it('does not run the verifier for a structurally incomplete draft', async () => {
    let validateSubmission = vi.fn(async () => []);
    let state = createRunState();
    let tools = createReviewTools({
      state,
      draft: new ReportDraft(definition),
      workspace: await createReviewWorkspace({ evidence: {}, history: {} }),
      ledger: new EvidenceLedger(),
      stages: [],
      hooks: { validateSubmission }
    });

    await tools.submit!.execute!(
      {},
      { toolCallId: 'submit', messages: [], context: undefined }
    );

    expect(state.submitted).toBe(false);
    expect(state.lastErrors).toEqual(['summary is required']);
    expect(validateSubmission).not.toHaveBeenCalled();
  });

  it('does not accept a draft that changed while verification was running', async () => {
    let state = createRunState();
    let draft = new ReportDraft(definition, { summary: { text: 'Original' } });
    let ledger = new EvidenceLedger();
    let tools = createReviewTools({
      state,
      draft,
      ledger,
      workspace: await createReviewWorkspace({ evidence: {}, history: {} }),
      stages: [],
      hooks: {
        validateSubmission: async () => {
          draft.writeSection('summary', { text: 'Changed concurrently' }, { ledger });
          return [];
        }
      }
    });

    await tools.submit!.execute!(
      {},
      { toolCallId: 'submit', messages: [], context: undefined }
    );

    expect(state.submitted).toBe(false);
    expect(state.lastErrors).toEqual([
      'The report changed during verification. Submit the current report again.'
    ]);
  });

  it('counts verifier usage against the shared budget', async () => {
    let extraCost = 0;
    let reviewer = new MockLanguageModelV4({ doGenerate: response([call('preview_scores')]) });
    let result = await runReviewAgent({
      model: { slug: 'reviewer', model: reviewer, pricing },
      system: 'system',
      prompt: 'prompt',
      state: createRunState(),
      tools: {
        preview_scores: tool({
          inputSchema: jsonSchema({ type: 'object', properties: {} }),
          execute: async () => {
            extraCost = 100_000;
            return {};
          }
        })
      },
      maxSteps: 10,
      maxCostMicros: 100_000,
      maxFixRounds: 2,
      extraCostMicros: () => extraCost
    });

    expect(result.outcome).toBe('cost_budget_exhausted');
    expect(reviewer.doGenerateCalls).toHaveLength(1);
  });

  it('does not let the reviewer request timeout interrupt a longer verifier tool call', async () => {
    vi.useFakeTimers();
    let state = createRunState();
    let reviewer = new MockLanguageModelV4({
      doGenerate: [response([call('submit')]), response([call('submit')])]
    });
    let calls = 0;
    let result = runReviewAgent({
      model: { slug: 'reviewer', model: reviewer, pricing } as ReviewModel,
      system: 'system',
      prompt: 'prompt',
      state,
      tools: {
        submit: tool({
          inputSchema: jsonSchema({ type: 'object', properties: {} }),
          execute: async () => {
            if (++calls == 1) {
              await new Promise(resolve => setTimeout(resolve, 4 * 60_000));
              return { ok: false, errors: ['summary: Fix the contradiction.'] };
            }
            state.submitted = true;
            return { ok: true };
          }
        })
      },
      maxSteps: 3,
      maxCostMicros: 100_000,
      maxFixRounds: 2
    });
    await vi.advanceTimersByTimeAsync(4 * 60_000);

    expect((await result).outcome).toBe('submitted');
    expect(reviewer.doGenerateCalls).toHaveLength(2);
  });
});
