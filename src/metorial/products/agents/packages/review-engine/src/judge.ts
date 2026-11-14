import { generateText, jsonSchema, Output } from 'ai';
import { setTimeout as delay } from 'node:timers/promises';
import { addUsage, emptyUsage, type ReviewModel } from './model';
import { acquireReviewModel, type ReviewModelAccess } from './rateLimit';

let JUDGE_TIMEOUT_MS = 3 * 60 * 1000;
let JUDGE_MAX_ATTEMPTS = 3;
let JUDGE_RETRY_DELAY_MS = 1000;

let JUDGE_SYSTEM = `You check a security review report for internal consistency. You do not judge whether the
reviewer was right, only whether the report agrees with itself.

Flag an issue when:
- the summary claims something no finding, capability or provenance section supports
- the summary's tone contradicts the scores (e.g. "no concerns" with a high-severity finding)
- a finding's severity clearly contradicts its own description
- a tool's tags contradict its described behavior (e.g. described as deleting data but not tagged destructive)
- the provenance body contradicts the provenance class

Do not flag style, length, or anything you would merely phrase differently. An empty issue list is the
expected result for a well-written report.`;

export type ConsistencyIssue = {
  section: string;
  message: string;
};

export type ConsistencyVerdict = {
  consistent: boolean;
  issues: ConsistencyIssue[];
};

export let runConsistencyJudge = async (d: {
  model: ReviewModel;
  modelAccess?: ReviewModelAccess;
  report: unknown;
  scores: unknown;
  abortSignal?: AbortSignal;
  onLog?: (entry: string) => void | Promise<void>;
}) => {
  let prompt = `<report>\n${JSON.stringify(d.report)}\n</report>\n\n<scores>\n${JSON.stringify(d.scores)}\n</scores>`;

  for (let attempt = 1; ; attempt++) {
    d.abortSignal?.throwIfAborted();
    await d.onLog?.(`consistency check attempt ${attempt}/${JUDGE_MAX_ATTEMPTS} started`);

    let model = await acquireReviewModel({
      model: d.model,
      access: d.modelAccess,
      signal: d.abortSignal
    });
    d.abortSignal?.throwIfAborted();
    await d.onLog?.(`consistency check attempt ${attempt}: using ${model.slug}`);

    try {
      let result = await generateText({
        model: model.model,
        instructions: JUDGE_SYSTEM,
        prompt,
        abortSignal: d.abortSignal,
        timeout: { stepMs: JUDGE_TIMEOUT_MS },
        output: Output.object({
          schema: jsonSchema<ConsistencyVerdict>({
            type: 'object',
            properties: {
              consistent: { type: 'boolean' },
              issues: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: { section: { type: 'string' }, message: { type: 'string' } },
                  required: ['section', 'message'],
                  additionalProperties: false
                }
              }
            },
            required: ['consistent', 'issues'],
            additionalProperties: false
          })
        })
      });

      return {
        verdict: result.output,
        usage: addUsage(emptyUsage(), result.usage, model.pricing)
      };
    } catch (error) {
      d.abortSignal?.throwIfAborted();
      if (
        !(error instanceof Error && error.name == 'TimeoutError') ||
        attempt >= JUDGE_MAX_ATTEMPTS
      ) {
        throw error;
      }

      let delayMs = JUDGE_RETRY_DELAY_MS * 2 ** (attempt - 1);
      await d.onLog?.(
        `consistency check attempt ${attempt}/${JUDGE_MAX_ATTEMPTS} timed out (${JUDGE_TIMEOUT_MS / 1000}s limit); retrying in ${delayMs / 1000}s`
      );
      await delay(delayMs, undefined, { signal: d.abortSignal });
    }
  }
};
