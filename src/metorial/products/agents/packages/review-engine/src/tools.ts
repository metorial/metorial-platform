import { Hash } from '@lowerdeck/hash';
import { jsonSchema, tool, type ToolSet } from 'ai';
import type { EvidenceLedger } from './ledger';
import type { ReportDraft } from './report';
import type { WebAccess } from './web';
import type { ReviewWorkspace } from './workspace';

let MAX_WEB_FETCHES = 20;
let MAX_WEB_SEARCHES = 10;

export type RecheckConclusion = {
  outcome: 'unchanged' | 'changed';
  summary: string;
  checked: { source: string; note: string }[];
};

export type ReviewRunState = {
  submitted: boolean;
  recheck: RecheckConclusion | null;
  fixRounds: number;
  webFetches: number;
  webSearches: number;
  lastErrors: string[];
};

export let createRunState = (): ReviewRunState => ({
  submitted: false,
  recheck: null,
  fixRounds: 0,
  webFetches: 0,
  webSearches: 0,
  lastErrors: []
});

export type ReviewToolHooks<R extends Record<string, any>> = {
  onStage?: (d: { stage: string; activity: string }) => Promise<void>;
  onSectionWritten?: (d: { section: string; report: Partial<R> }) => Promise<void>;
  previewScores?: (report: Partial<R>) => Promise<unknown>;
  validateSubmission?: (report: Partial<R>) => Promise<string[]>;
};

let formatErrors = (errors: string[]) => ({ ok: false as const, errors });

export let createReviewTools = <R extends Record<string, any>>(d: {
  workspace: ReviewWorkspace;
  ledger: EvidenceLedger;
  draft: ReportDraft<R>;
  state: ReviewRunState;
  stages: string[];
  web?: WebAccess;
  recheck?: boolean;
  hooks: ReviewToolHooks<R>;
}) => {
  let ctx = { ledger: d.ledger };
  let fetchedThisRun = new Set<string>();

  let tools: ToolSet = {
    bash: tool({
      description:
        'Run a bash command in the review workspace. /evidence and /history are read-only, ' +
        '/workspace is your scratch space and persists across reviews, /report holds the sections ' +
        'you have written (read-only, use write_section to change it). Supports grep, find, cat, ' +
        'sed, awk, jq, head, tail, wc, sort, uniq, diff and pipes.',
      inputSchema: jsonSchema<{ command: string }>({
        type: 'object',
        properties: { command: { type: 'string', description: 'The command to run.' } },
        required: ['command'],
        additionalProperties: false
      }),
      execute: async input => await d.workspace.exec(input.command)
    }),

    set_stage: tool({
      description:
        'Tell the user what you are doing. Call this whenever you move to a new stage, with a ' +
        'short present-tense activity such as "Reading the tool handlers".',
      inputSchema: jsonSchema<{ stage: string; activity: string }>({
        type: 'object',
        properties: {
          stage: { type: 'string', enum: d.stages },
          activity: { type: 'string', maxLength: 120 }
        },
        required: ['stage', 'activity'],
        additionalProperties: false
      }),
      execute: async input => {
        await d.hooks.onStage?.(input);
        return { ok: true };
      }
    }),

    write_section: tool({
      description:
        'Write or replace one section of the report. The value is validated against the section ' +
        'shape and every evidence reference is checked against the evidence ledger. Invalid ' +
        'sections are rejected with a list of errors; fix them and write the section again.',
      inputSchema: jsonSchema<{ section: string; value: unknown }>({
        type: 'object',
        properties: {
          section: { type: 'string', enum: d.draft.sectionNames },
          value: { description: 'The section value, matching the documented shape.' }
        },
        required: ['section', 'value'],
        additionalProperties: false
      }),
      execute: async input => {
        let result = d.draft.writeSection(input.section, input.value, ctx);
        if (result.errors.length) return formatErrors(result.errors);

        await d.workspace.writeReportFile(
          `/${input.section}.json`,
          JSON.stringify(result.value, null, 2)
        );
        await d.hooks.onSectionWritten?.({ section: input.section, report: d.draft.current });

        return { ok: true };
      }
    }),

    preview_scores: tool({
      description:
        'Compute the scores the current report would receive. Scores are deterministic and ' +
        'derived from your findings and capabilities; you cannot set them directly.',
      inputSchema: jsonSchema<{}>({
        type: 'object',
        properties: {},
        additionalProperties: false
      }),
      execute: async () =>
        d.hooks.previewScores ? await d.hooks.previewScores(d.draft.current) : {}
    }),

    submit: tool({
      description:
        'Submit the report. The whole report is validated; if anything is wrong you get the ' +
        'errors back and must fix them before submitting again. Only call this when every ' +
        'required section has been written.',
      inputSchema: jsonSchema<{}>({
        type: 'object',
        properties: {},
        additionalProperties: false
      }),
      execute: async () => {
        let errors = d.draft.validate(ctx);
        if (d.hooks.validateSubmission) {
          errors.push(...(await d.hooks.validateSubmission(d.draft.current)));
        }

        d.state.lastErrors = errors;

        if (errors.length) {
          d.state.fixRounds++;
          return formatErrors(errors);
        }

        d.state.submitted = true;
        return { ok: true };
      }
    })
  };

  if (d.recheck) {
    tools.conclude_recheck = tool({
      description:
        'Report the result of the re-check. Use "unchanged" when nothing material has changed: ' +
        'list every page or file you compared, each with a note on what you compared. A cited ' +
        'url must have been fetched in this run. Use "changed" when something material changed; ' +
        'you then continue with a full update of the report.',
      inputSchema: jsonSchema<{
        outcome: 'unchanged' | 'changed';
        summary: string;
        checked: { source: string; note: string }[];
      }>({
        type: 'object',
        properties: {
          outcome: { type: 'string', enum: ['unchanged', 'changed'] },
          summary: { type: 'string', maxLength: 500 },
          checked: {
            type: 'array',
            items: {
              type: 'object',
              properties: { source: { type: 'string' }, note: { type: 'string' } },
              required: ['source', 'note'],
              additionalProperties: false
            }
          }
        },
        required: ['outcome', 'summary', 'checked'],
        additionalProperties: false
      }),
      execute: async input => {
        if (input.outcome == 'unchanged') {
          let errors = input.checked.flatMap(entry => {
            if (/^https?:\/\//.test(entry.source)) {
              return fetchedThisRun.has(entry.source.trim())
                ? []
                : [`url "${entry.source}" was not fetched during this re-check`];
            }

            let error = d.ledger.check({ type: 'file', path: entry.source });
            return error ? [error] : [];
          });
          if (!input.checked.length) errors.push('List at least one source you compared');
          if (errors.length) return formatErrors(errors);
        }

        d.state.recheck = input;
        return { ok: true };
      }
    });
  }

  if (d.web) {
    let web = d.web;

    tools.web_search = tool({
      description:
        'Search the web. Use this to find the official documentation, repository or announcement ' +
        'for a vendor and its MCP server. Results are not evidence; fetch a page to cite it.',
      inputSchema: jsonSchema<{ query: string }>({
        type: 'object',
        properties: { query: { type: 'string' } },
        required: ['query'],
        additionalProperties: false
      }),
      execute: async input => {
        if (d.state.webSearches >= MAX_WEB_SEARCHES) {
          return formatErrors(['Web search budget for this review is exhausted']);
        }
        d.state.webSearches++;

        return { ok: true, results: await web.search(input.query) };
      }
    });

    tools.fetch_url = tool({
      description:
        'Fetch a web page. The page is snapshotted into /workspace/web/ and becomes citable ' +
        'evidence as {"type":"url","url":...}. Returns the snapshot path and a preview; use bash ' +
        'to read the full snapshot.',
      inputSchema: jsonSchema<{ url: string }>({
        type: 'object',
        properties: { url: { type: 'string' } },
        required: ['url'],
        additionalProperties: false
      }),
      execute: async input => {
        if (d.state.webFetches >= MAX_WEB_FETCHES) {
          return formatErrors(['Web fetch budget for this review is exhausted']);
        }
        d.state.webFetches++;

        try {
          let page = await web.fetch(input.url);
          let hash = await Hash.sha256(page.markdown);
          let path = `/web/${hash.slice(0, 16)}.md`;

          await d.workspace.writeWorkspaceFile(
            path,
            `<!-- source: ${input.url} -->\n${page.markdown}`
          );
          d.ledger.addUrl(input.url, hash);
          fetchedThisRun.add(input.url.trim());

          return {
            ok: true,
            snapshot: `/workspace${path}`,
            preview: page.markdown.slice(0, 2_000)
          };
        } catch (error) {
          return formatErrors([error instanceof Error ? error.message : 'Fetch failed']);
        }
      }
    });
  }

  return tools;
};
