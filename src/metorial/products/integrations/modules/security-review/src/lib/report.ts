import { v, type ValidationType } from '@lowerdeck/validation';
import type {
  SecurityLedgerRef,
  SecurityProvenanceClass,
  SecurityReport,
  SecurityReportFinding
} from '@metorial-subspace/db';
import {
  defineReport,
  type ReportValidationContext,
  type SectionValidationResult
} from '@metorial/review-engine';

export let SUMMARY_MAX = 320;
export let NOTE_MAX = 220;
export let BODY_MAX = 700;
let TITLE_MAX = 100;

let capabilityTags = [
  'read',
  'write',
  'untrusted_input',
  'destructive',
  'external_send',
  'bulk_private_data',
  'access_control',
  'financial',
  'code_execution',
  'infrastructure'
] as const;

let findingCategories = [
  'provenance',
  'impersonation',
  'tool_poisoning',
  'secrets',
  'dependencies',
  'input_validation',
  'auth',
  'transport',
  'data_handling',
  'spec_variance',
  'annotation_mismatch',
  'excessive_scope',
  'capability',
  'implementation',
  'instruction_manipulation',
  'hidden_content',
  'remote_code',
  'remote_instructions',
  'exfiltration',
  'credentials',
  'supply_chain',
  'persistence',
  'over_privilege',
  'trigger_abuse',
  'agentic_abuse',
  'shadow_features',
  'opaque_content',
  'reviewer_targeting',
  'other'
] as const;

let skillCapabilityTags = [
  'code_execution',
  'network_egress',
  'filesystem_outside_skill',
  'credential_access',
  'package_install',
  'persistence',
  'mcp_dependency',
  'subagents',
  'binary_payload',
  'financial'
] as const;

let severities = ['info', 'low', 'medium', 'high', 'critical'] as const;

let provenanceClasses = [
  'metorial_built',
  'tenant_code',
  'tenant_image',
  'tenant_remote_vendor_verified',
  'tenant_remote_vendor_plausible',
  'tenant_remote_third_party',
  'tenant_remote_unverifiable',
  'impersonation_suspected',
  'tenant_authored',
  'imported_public_repo',
  'imported_private_repo',
  'uploaded_archive',
  'forked'
] as const;

let bannedPhrases = [
  'our ai',
  'as an ai',
  'may potentially',
  'it is important to note',
  'delve'
];

export let text = (max: number) => v.string({ modifiers: [v.minLength(1), v.maxLength(max)] });

let ledgerRef = v.union([
  v.object({
    type: v.literal('file'),
    path: v.string(),
    lines: v.optional(v.array(v.number(), { modifiers: [v.minLength(2), v.maxLength(2)] })),
    excerpt: v.optional(v.string())
  }),
  v.object({ type: v.literal('url'), url: v.string() }),
  v.object({ type: v.literal('tool'), key: v.string() }),
  v.object({
    type: v.literal('fact'),
    id: v.string(),
    title: v.optional(v.string()),
    detail: v.optional(v.string())
  })
]);

export let evidence = v.array(ledgerRef);

export let point = v.object({ title: text(TITLE_MAX), body: text(BODY_MAX), evidence });

let finding = v.object({
  key: v.string({ modifiers: [v.regex(/^[a-z0-9]+(-[a-z0-9]+)*$/), v.maxLength(64)] }),
  kind: v.enumOf(['security', 'capability', 'positive']),
  category: v.enumOf([...findingCategories]),
  severity: v.enumOf([...severities]),
  title: text(TITLE_MAX),
  body: text(BODY_MAX),
  recommendation: v.optional(text(BODY_MAX)),
  tools: v.array(v.string()),
  evidence
});

let reportTool = v.object({
  key: v.string(),
  name: v.optional(v.string()),
  tags: v.array(v.enumOf([...capabilityTags]), { modifiers: [v.minLength(1)] }),
  behavior: text(BODY_MAX),
  declaredHints: v.object({
    readOnly: v.optional(v.boolean()),
    destructive: v.optional(v.boolean()),
    idempotent: v.optional(v.boolean()),
    openWorld: v.optional(v.boolean())
  }),
  hintAccuracy: v.enumOf(['matches', 'mismatch', 'undeclared'])
});

let reportBehavior = v.object({
  tag: v.enumOf([...skillCapabilityTags]),
  body: text(BODY_MAX),
  evidence
});

let reportCapabilities = v.object({
  tools: v.array(reportTool),
  behaviors: v.optional(v.array(reportBehavior))
});

export let securityFindingSchema = finding;

export let securityReportEditSchema = v.object({
  summary: v.optional(
    v.object({
      text: text(SUMMARY_MAX),
      trustNote: text(NOTE_MAX),
      exposureNote: text(NOTE_MAX)
    })
  ),
  provenance: v.optional(
    v.object({ class: v.enumOf([...provenanceClasses]), body: text(BODY_MAX), evidence })
  ),
  capabilities: v.optional(reportCapabilities),
  implementation: v.optional(
    v.object({ strengths: v.array(point), weaknesses: v.array(point) })
  ),
  changes: v.optional(v.object({ body: text(BODY_MAX) })),
  method: v.optional(
    v.object({
      included: v.array(v.string()),
      outOfScope: v.array(v.string()),
      limitations: v.array(v.string())
    })
  )
});

let formatErrors = (errors: { message: string; path?: string[] }[]) =>
  errors.map(error =>
    error.path?.length ? `${error.path.join('.')}: ${error.message}` : error.message
  );

let collectText = (value: unknown, path: string[] = []): { path: string; text: string }[] => {
  if (typeof value == 'string') return [{ path: path.join('.'), text: value }];
  if (Array.isArray(value))
    return value.flatMap((item, i) => collectText(item, [...path, String(i)]));
  if (value && typeof value == 'object') {
    return Object.entries(value).flatMap(([key, item]) =>
      key == 'evidence' || key == 'key' || key == 'tools'
        ? []
        : collectText(item, [...path, key])
    );
  }
  return [];
};

export let checkStyle = (value: unknown) => {
  let errors: string[] = [];

  for (let field of collectText(value)) {
    let lower = field.text.toLowerCase();

    if (/^\s*#{1,6}\s/m.test(field.text)) {
      errors.push(`${field.path}: do not use markdown headings`);
    }
    for (let phrase of bannedPhrases) {
      if (lower.includes(phrase)) errors.push(`${field.path}: avoid the phrase "${phrase}"`);
    }
    if (/\b\d{1,3}\s*(\/\s*100|out of 100|points?)\b|\bscore of \d/i.test(field.text)) {
      errors.push(
        `${field.path}: do not mention scores in prose, they are rendered from data`
      );
    }
  }

  return errors;
};

export let checkEvidence = (
  refs: SecurityLedgerRef[],
  ctx: ReportValidationContext,
  path: string
) =>
  refs
    .map(ref => ctx.ledger.check(ref as any))
    .filter((error): error is string => !!error)
    .map(error => `${path}: ${error}`);

export let section =
  <T>(
    validator: ValidationType<T>,
    extra?: (value: T, ctx: ReportValidationContext) => string[]
  ) =>
  (raw: unknown, ctx: ReportValidationContext): SectionValidationResult<T> => {
    let result = validator.validate(raw);
    if (!result.success) return { errors: formatErrors(result.errors) };

    let errors = [...checkStyle(result.value), ...(extra?.(result.value, ctx) ?? [])];
    return errors.length ? { errors } : { value: result.value, errors: [] };
  };

export let countSentences = (value: string) =>
  value
    .split(/(?<=[.!?])\s+/)
    .map(sentence => sentence.trim())
    .filter(Boolean).length;

export type SecurityReportSubjectContext = {
  expectedToolKeys: string[] | null;
  allowedProvenance: SecurityProvenanceClass[];
  requiresImplementation: boolean;
  isSkill?: boolean;
  hasHistory: boolean;
  previousFindingKeys: string[];
  lockedFindings: SecurityReportFinding[];
};

let lockedSignature = (finding: SecurityReportFinding) =>
  JSON.stringify([
    finding.kind,
    finding.category,
    finding.severity,
    finding.title,
    finding.body
  ]);

export let createSecurityReportDefinition = (subject: SecurityReportSubjectContext) =>
  defineReport<SecurityReport>({
    sections: {
      summary: {
        description:
          'At most two short sentences: the trust verdict and its main reason, then the most ' +
          'consequential access or concrete issue (or top fix for custom code). Do not list every ' +
          'capability. trustNote and exposureNote are one short sentence each, shown under the ' +
          'Security and Exposure scores.',
        shape: '{ text: string; trustNote: string; exposureNote: string }',
        validate: section(
          v.object({
            text: text(SUMMARY_MAX),
            trustNote: text(NOTE_MAX),
            exposureNote: text(NOTE_MAX)
          }),
          value => (countSentences(value.text) > 2 ? ['text: use at most two sentences'] : [])
        )
      },

      provenance: {
        description: subject.isSkill
          ? 'In one short sentence, state where the skill came from using the platform fact ' +
            'provenance, and cite that fact. Keep the given class. Describe an import, upload or ' +
            'fork without inferring original authorship. No server operator, metadata inventory ' +
            'or routine vendor affiliation disclaimers. Report concrete impersonation as a finding.'
          : subject.allowedProvenance.includes('metorial_built')
            ? 'Ownership is established. Use class metorial_built, body "Built and operated by ' +
              'Metorial." and evidence [{"type":"fact","id":"metorial-origin"}]. No vendor ' +
              'affiliation disclaimers, branding evidence, registry identifiers or versions.'
            : 'Identify who built or operates this server or skill in one short sentence. Add a ' +
              'second only for a material uncertainty about ownership. Keep supporting proof in ' +
              'evidence references rather than narrating it. Use impersonation_suspected only for ' +
              'evidence of a misleading authorship or affiliation claim, not a service name alone.',
        shape: `{ class: ${subject.allowedProvenance.map(value => `'${value}'`).join(' | ')}; body: string; evidence: LedgerRef[] }`,
        validate: section(
          v.object({
            class: v.enumOf([...provenanceClasses]),
            body: text(BODY_MAX),
            evidence
          }),
          (value, ctx) => [
            ...(subject.allowedProvenance.includes(value.class)
              ? []
              : [`class: must be one of ${subject.allowedProvenance.join(', ')}`]),
            ...(value.evidence.length ? [] : ['evidence: cite at least one source']),
            ...checkEvidence(value.evidence, ctx, 'evidence')
          ]
        )
      },

      capabilities: {
        description: subject.isSkill
          ? 'The skill has no tools: write an empty tools list. List what the skill can do as ' +
            'behaviors, one entry per tag, each with a one-sentence body and evidence. Deterministic ' +
            'behaviors are already recorded and kept.'
          : 'Every tool in the specification exactly once. Tag what the tool can actually do, not ' +
            'what its annotations claim. behavior is one short sentence naming the operation and ' +
            'the data or access it affects; omit parameter inventories and routine API mechanics. ' +
            'hintAccuracy compares your tags to the declared MCP hints.',
        shape:
          '{ tools: { key: string; name?: string; tags: CapabilityTag[]; behavior: string; ' +
          'declaredHints: { readOnly?: boolean; destructive?: boolean; idempotent?: boolean; openWorld?: boolean }; ' +
          "hintAccuracy: 'matches' | 'mismatch' | 'undeclared' }[]" +
          (subject.isSkill
            ? '; behaviors: { tag: SkillCapabilityTag; body: string; evidence: LedgerRef[] }[]'
            : '') +
          ' }\n' +
          `type CapabilityTag = ${capabilityTags.map(tag => `'${tag}'`).join(' | ')}` +
          (subject.isSkill
            ? `\ntype SkillCapabilityTag = ${skillCapabilityTags.map(tag => `'${tag}'`).join(' | ')}`
            : ''),
        validate: section(reportCapabilities, (value, ctx) => {
          let errors: string[] = [];
          let seen = new Set<string>();

          for (let tool of value.tools) {
            if (seen.has(tool.key)) errors.push(`tools: "${tool.key}" appears more than once`);
            seen.add(tool.key);

            let missing = ctx.ledger.check({ type: 'tool', key: tool.key });
            if (missing) errors.push(`tools: ${missing}`);
          }

          let tags = new Set<string>();
          for (let behavior of value.behaviors ?? []) {
            if (tags.has(behavior.tag))
              errors.push(`behaviors: "${behavior.tag}" appears more than once`);
            tags.add(behavior.tag);

            errors.push(
              ...checkEvidence(behavior.evidence, ctx, `behaviors.${behavior.tag}.evidence`)
            );
          }

          return errors;
        })
      },

      implementation: {
        description: subject.isSkill
          ? 'Optional, only for reviewable scripts with substantive security properties. Omit for ' +
            'prose-only skills. Do not manufacture strengths or weaknesses from absent features, ' +
            'or assess writing quality. Cite file and line ranges for each point.'
          : 'Only for source code you could read: concrete strengths and weaknesses of the ' +
            'implementation, each citing file and line ranges.',
        shape:
          '{ strengths: Point[]; weaknesses: Point[] }\ntype Point = { title: string; body: string; evidence: LedgerRef[] }',
        validate: section(
          v.object({ strengths: v.array(point), weaknesses: v.array(point) }),
          (value, ctx) =>
            [...value.strengths, ...value.weaknesses].flatMap((item, i) =>
              checkEvidence(item.evidence, ctx, `points.${i}.evidence`)
            )
        )
      },

      findings: {
        description:
          'Security findings (with severity), capability findings (severity info, they describe ' +
          'what the tools can do) and positive findings (severity info, good practices in custom ' +
          'code). State the concrete behavior and consequence briefly; recommendations name a ' +
          'specific fix only when needed. Group related capability observations rather than ' +
          'repeating the tool catalog. An empty list is correct when there is nothing notable. ' +
          'Keys are stable kebab-case identifiers: reuse a previous key when the same issue persists.',
        shape:
          "{ key: string; kind: 'security' | 'capability' | 'positive'; category: FindingCategory; " +
          "severity: 'info' | 'low' | 'medium' | 'high' | 'critical'; title: string; body: string; " +
          'recommendation?: string; tools: string[]; evidence: LedgerRef[] }[]\n' +
          `type FindingCategory = ${findingCategories.map(category => `'${category}'`).join(' | ')}`,
        validate: section(v.array(finding), (value, ctx) => {
          let errors: string[] = [];
          let keys = new Set<string>();

          value.forEach((item, i) => {
            if (keys.has(item.key)) errors.push(`${i}.key: "${item.key}" is not unique`);
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

      resolvedFindings: {
        description:
          'Previous finding keys that no longer apply, each with a one-sentence reason. Every ' +
          'previous key must either appear in findings again or be listed here.',
        shape: '{ key: string; reason: string }[]',
        validate: section(v.array(v.object({ key: v.string(), reason: text(BODY_MAX) })))
      },

      changes: {
        description:
          'Briefly state what materially changed since the previous revision and its effect. ' +
          'Do not retell the previous review. Required when /history is not empty.',
        shape: '{ body: string }',
        validate: section(v.object({ body: text(BODY_MAX) }))
      },

      method: {
        description:
          'What this review covered, what it did not, and its limitations (unreadable files, ' +
          'unreachable docs, tools not yet discovered). Use short scope labels and list only real ' +
          'gaps. Do not explain routine authentication or repeat the verdict. Empty optional lists ' +
          'are fine.',
        shape: '{ included: string[]; outOfScope: string[]; limitations: string[] }',
        validate: section(
          v.object({
            included: v.array(text(BODY_MAX), { modifiers: [v.minLength(1)] }),
            outOfScope: v.array(text(BODY_MAX)),
            limitations: v.array(text(BODY_MAX))
          })
        )
      }
    },

    validateReport: report => {
      let errors: string[] = [];

      for (let name of [
        'summary',
        'provenance',
        'capabilities',
        'findings',
        'method'
      ] as const) {
        if (report[name] === undefined) errors.push(`${name}: section is required`);
      }
      if (subject.requiresImplementation && !report.implementation) {
        errors.push('implementation: section is required for source code reviews');
      }
      if (subject.hasHistory && !report.changes) {
        errors.push('changes: section is required because previous revisions exist');
      }

      if (subject.expectedToolKeys && report.capabilities) {
        let covered = new Set(report.capabilities.tools.map(tool => tool.key));
        let missing = subject.expectedToolKeys.filter(key => !covered.has(key));
        if (missing.length) errors.push(`capabilities: missing tools ${missing.join(', ')}`);
      }

      let emitted = new Set((report.findings ?? []).map(item => item.key));
      let resolved = new Set((report.resolvedFindings ?? []).map(item => item.key));
      let unaccounted = subject.previousFindingKeys.filter(
        key => !emitted.has(key) && !resolved.has(key)
      );
      if (unaccounted.length) {
        errors.push(
          `findings: previous findings ${unaccounted.join(', ')} must be re-emitted or listed in resolvedFindings`
        );
      }

      for (let locked of subject.lockedFindings) {
        let current = report.findings?.find(item => item.key == locked.key);
        if (!current || lockedSignature(current) != lockedSignature(locked)) {
          errors.push(`findings: "${locked.key}" is locked and must be kept unchanged`);
        }
      }

      return errors;
    }
  });
