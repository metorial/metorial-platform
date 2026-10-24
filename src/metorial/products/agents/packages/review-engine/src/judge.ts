import { generateText, jsonSchema, Output } from 'ai';
import { addUsage, emptyUsage, type ReviewModel } from './model';

export type ConsistencyIssue = {
  section: string;
  message: string;
};

export type ConsistencyVerdict = {
  consistent: boolean;
  issues: ConsistencyIssue[];
};

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

export let runConsistencyJudge = async (d: {
  model: ReviewModel;
  report: unknown;
  scores: unknown;
  abortSignal?: AbortSignal;
}) => {
  let result = await generateText({
    model: d.model.model,
    system: JUDGE_SYSTEM,
    prompt: `<report>\n${JSON.stringify(d.report, null, 2)}\n</report>\n\n<scores>\n${JSON.stringify(d.scores, null, 2)}\n</scores>`,
    abortSignal: d.abortSignal,
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
    usage: addUsage(emptyUsage(), result.usage, d.model.pricing)
  };
};
