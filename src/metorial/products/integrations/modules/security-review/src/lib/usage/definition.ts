import { v } from '@lowerdeck/validation';
import type { SecurityUsageReport } from '@metorial-subspace/db';
import { defineReport } from '@metorial/review-engine';
import {
  BODY_MAX,
  checkEvidence,
  countSentences,
  evidence,
  NOTE_MAX,
  section,
  securityFindingSchema,
  SUMMARY_MAX,
  text
} from '../report';

let RECOMMENDATION_MAX = 5;

let bodySection = v.object({ body: text(BODY_MAX), evidence });

export type UsageReportContext = {
  recordedFindingKeys: string[];
};

export let createUsageReportDefinition = (subject: UsageReportContext) =>
  defineReport<SecurityUsageReport>({
    sections: {
      summary: {
        description:
          'Two sentences. Sentence one says what the observed usage shows about how this ' +
          'integration is really used. Sentence two names the most important gap between what is ' +
          'allowed and what is used. exposureNote is one sentence shown under the observed exposure.',
        shape: '{ text: string; exposureNote: string }',
        validate: section(
          v.object({ text: text(SUMMARY_MAX), exposureNote: text(NOTE_MAX) }),
          value => (countSentences(value.text) > 2 ? ['text: use at most two sentences'] : [])
        )
      },

      observedExposure: {
        description:
          'What the tools that were actually called can do to the connected accounts, compared ' +
          'with everything the integration allows. Cite /evidence/usage/tools.json and tool keys.',
        shape: '{ body: string; evidence: LedgerRef[] }',
        validate: section(bodySection, (value, ctx) => [
          ...(value.evidence.length ? [] : ['evidence: cite at least one source']),
          ...checkEvidence(value.evidence, ctx, 'evidence')
        ])
      },

      access: {
        description:
          'How access is granted: the scopes the connected accounts hold compared with the scopes ' +
          'the called tools need, and whether tool filters narrow what is available. Cite ' +
          '/evidence/usage/scopes.json and /evidence/usage/tool-filters.json.',
        shape: '{ body: string; evidence: LedgerRef[] }',
        validate: section(bodySection, (value, ctx) => [
          ...(value.evidence.length ? [] : ['evidence: cite at least one source']),
          ...checkEvidence(value.evidence, ctx, 'evidence')
        ])
      },

      runtime: {
        description:
          'What ProtoGuard matched at runtime: which kinds of issues, how severe, in which tools ' +
          'and directions. Say plainly when nothing notable was matched. Cite ' +
          '/evidence/usage/protoguard.json.',
        shape: '{ body: string; evidence: LedgerRef[] }',
        validate: section(bodySection, (value, ctx) => [
          ...(value.evidence.length ? [] : ['evidence: cite at least one source']),
          ...checkEvidence(value.evidence, ctx, 'evidence')
        ])
      },

      findings: {
        description:
          'Findings that follow from the observed usage and that the recorded findings in ' +
          '/evidence/facts.json do not already cover. Use kind security with a severity, or ' +
          'capability with severity info. Keys are stable kebab-case identifiers. An empty list is ' +
          'fine when the usage shows nothing notable.',
        shape:
          "{ key: string; kind: 'security' | 'capability' | 'positive'; category: string; " +
          "severity: 'info' | 'low' | 'medium' | 'high' | 'critical'; title: string; body: string; " +
          'recommendation?: string; tools: string[]; evidence: LedgerRef[] }[]',
        validate: section(v.array(securityFindingSchema), (value, ctx) => {
          let errors: string[] = [];
          let keys = new Set<string>();

          value.forEach((item, i) => {
            if (keys.has(item.key)) errors.push(`${i}.key: "${item.key}" is not unique`);
            if (subject.recordedFindingKeys.includes(item.key)) {
              errors.push(`${i}.key: "${item.key}" is already recorded, do not repeat it`);
            }
            keys.add(item.key);

            if (item.kind != 'security' && item.severity != 'info') {
              errors.push(`${i}.severity: ${item.kind} findings must use severity info`);
            }
            if (item.kind == 'security' && item.severity != 'info' && !item.evidence.length) {
              errors.push(`${i}.evidence: security findings need evidence`);
            }
            for (let key of item.tools) {
              let missing = ctx.ledger.check({ type: 'tool', key });
              if (missing) errors.push(`${i}.tools: ${missing}`);
            }
            errors.push(...checkEvidence(item.evidence, ctx, `${i}.evidence`));
          });

          return errors;
        })
      },

      recommendations: {
        description:
          `At most ${RECOMMENDATION_MAX} actions that narrow what this integration exposes, ordered by impact: ` +
          'block a tool with a tool filter, or drop a scope no used tool needs. Each must follow from the ' +
          'usage data. Never recommend monitoring, alerting, observation periods or re-running the review. ' +
          'An empty list is the right answer when there is nothing to narrow.',
        shape: '{ title: string; body: string; evidence: LedgerRef[] }[]',
        validate: section(
          v.array(v.object({ title: text(100), body: text(BODY_MAX), evidence }), {
            modifiers: [v.maxLength(RECOMMENDATION_MAX)]
          }),
          (value, ctx) =>
            value.flatMap((item, i) => checkEvidence(item.evidence, ctx, `${i}.evidence`))
        )
      },

      method: {
        description:
          'What the usage review covered and its limitations. Little usage, a short window or a single ' +
          'configuration belong here as limitations, not in recommendations or findings.',
        shape: '{ included: string[]; limitations: string[] }',
        validate: section(
          v.object({
            included: v.array(text(BODY_MAX), { modifiers: [v.minLength(1)] }),
            limitations: v.array(text(BODY_MAX))
          })
        )
      }
    },

    validateReport: report => {
      let errors: string[] = [];

      for (let name of [
        'summary',
        'observedExposure',
        'access',
        'runtime',
        'findings',
        'method'
      ] as const) {
        if (report[name] === undefined) errors.push(`${name}: section is required`);
      }

      return errors;
    }
  });
