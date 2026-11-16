import { mapObject } from '@metorial/util-resource-mapper/compact';

export type SkillsSecurityReviewDismissOutput = {
  object: 'skill.security_review';
  id: string;
  skillId: string | null;
  verdict: 'pass' | 'warn' | 'fail' | 'pending' | 'unavailable' | 'dismissed';
  dismissedAt: Date | null;
  currentRevision: {
    object: 'skill.security_review.revision';
    id: string;
    securityReviewId: string;
    skillVersionId: string | null;
    number: number;
    status:
      | 'queued'
      | 'running'
      | 'completed'
      | 'completed_with_gaps'
      | 'failed'
      | 'blocked';
    stage: 'collecting' | 'verifying' | 'analyzing' | 'writing' | null;
    blockReason: 'billing' | 'ai_disabled' | 'admin_disabled' | null;
    aiGenerated: boolean;
    trigger:
      | 'first_use'
      | 'page_open'
      | 'new_version'
      | 'deployment'
      | 'tools_discovered'
      | 'census_changed'
      | 'scheduled'
      | 'prompt_update'
      | 'reassess'
      | 'skill_import';
    files: {
      total: number;
      analyzed: number;
      kinds: Record<string, number>;
    } | null;
    scores: {
      securityScore: number;
      band: 'strong' | 'good' | 'fair' | 'weak' | 'poor';
      exposure: 'unknown' | 'low' | 'moderate' | 'high' | 'critical';
      risk: 'low' | 'moderate' | 'high' | 'critical';
      confidence: 'low' | 'medium' | 'high';
      lethalTrifecta: boolean;
      headline: string[];
      findingCounts: {
        info: number;
        low: number;
        medium: number;
        high: number;
        critical: number;
      };
    } | null;
    report: {
      summary: { text: string; trustNote: string; exposureNote: string } | null;
      provenance: {
        class:
          | 'tenant_authored'
          | 'imported_public_repo'
          | 'imported_private_repo'
          | 'uploaded_archive'
          | 'forked';
        body: string;
      } | null;
      behaviors: {
        tag:
          | 'code_execution'
          | 'network_egress'
          | 'filesystem_outside_skill'
          | 'credential_access'
          | 'package_install'
          | 'persistence'
          | 'mcp_dependency'
          | 'subagents'
          | 'binary_payload'
          | 'financial';
        body: string;
        evidence: { type: 'file'; path: string; lines: number[] | null }[];
      }[];
      implementation: {
        strengths: {
          title: string;
          body: string;
          evidence: { type: 'file'; path: string; lines: number[] | null }[];
        }[];
        weaknesses: {
          title: string;
          body: string;
          evidence: { type: 'file'; path: string; lines: number[] | null }[];
        }[];
      } | null;
      resolvedFindings: { key: string; reason: string }[];
      changes: { body: string } | null;
      method: {
        included: string[];
        outOfScope: string[];
        limitations: string[];
      } | null;
    };
    findings: {
      key: string;
      kind: 'security' | 'capability' | 'positive';
      category: string;
      severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
      change: 'new' | 'persisting' | 'resolved';
      title: string;
      body: string;
      recommendation: string | null;
      evidence: { type: 'file'; path: string; lines: number[] | null }[];
    }[];
    startedAt: Date | null;
    completedAt: Date | null;
    createdAt: Date;
  } | null;
  inProgressRevision: {
    object: 'skill.security_review.revision';
    id: string;
    securityReviewId: string;
    skillVersionId: string | null;
    number: number;
    status:
      | 'queued'
      | 'running'
      | 'completed'
      | 'completed_with_gaps'
      | 'failed'
      | 'blocked';
    stage: 'collecting' | 'verifying' | 'analyzing' | 'writing' | null;
    blockReason: 'billing' | 'ai_disabled' | 'admin_disabled' | null;
    aiGenerated: boolean;
    trigger:
      | 'first_use'
      | 'page_open'
      | 'new_version'
      | 'deployment'
      | 'tools_discovered'
      | 'census_changed'
      | 'scheduled'
      | 'prompt_update'
      | 'reassess'
      | 'skill_import';
    files: {
      total: number;
      analyzed: number;
      kinds: Record<string, number>;
    } | null;
    scores: {
      securityScore: number;
      band: 'strong' | 'good' | 'fair' | 'weak' | 'poor';
      exposure: 'unknown' | 'low' | 'moderate' | 'high' | 'critical';
      risk: 'low' | 'moderate' | 'high' | 'critical';
      confidence: 'low' | 'medium' | 'high';
      lethalTrifecta: boolean;
      headline: string[];
      findingCounts: {
        info: number;
        low: number;
        medium: number;
        high: number;
        critical: number;
      };
    } | null;
    report: {
      summary: { text: string; trustNote: string; exposureNote: string } | null;
      provenance: {
        class:
          | 'tenant_authored'
          | 'imported_public_repo'
          | 'imported_private_repo'
          | 'uploaded_archive'
          | 'forked';
        body: string;
      } | null;
      behaviors: {
        tag:
          | 'code_execution'
          | 'network_egress'
          | 'filesystem_outside_skill'
          | 'credential_access'
          | 'package_install'
          | 'persistence'
          | 'mcp_dependency'
          | 'subagents'
          | 'binary_payload'
          | 'financial';
        body: string;
        evidence: { type: 'file'; path: string; lines: number[] | null }[];
      }[];
      implementation: {
        strengths: {
          title: string;
          body: string;
          evidence: { type: 'file'; path: string; lines: number[] | null }[];
        }[];
        weaknesses: {
          title: string;
          body: string;
          evidence: { type: 'file'; path: string; lines: number[] | null }[];
        }[];
      } | null;
      resolvedFindings: { key: string; reason: string }[];
      changes: { body: string } | null;
      method: {
        included: string[];
        outOfScope: string[];
        limitations: string[];
      } | null;
    };
    findings: {
      key: string;
      kind: 'security' | 'capability' | 'positive';
      category: string;
      severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
      change: 'new' | 'persisting' | 'resolved';
      title: string;
      body: string;
      recommendation: string | null;
      evidence: { type: 'file'; path: string; lines: number[] | null }[];
    }[];
    startedAt: Date | null;
    completedAt: Date | null;
    createdAt: Date;
  } | null;
  createdAt: Date;
  updatedAt: Date;
};

export let mapSkillsSecurityReviewDismissOutput =
  /* @__PURE__ */ mapObject<SkillsSecurityReviewDismissOutput>(
    [
      'skill_id',
      'dismissed_at',
      [
        'current_revision',
        1,
        [
          1,
          [
            'security_review_id',
            'skill_version_id',
            'block_reason',
            'ai_generated',
            [
              'scores',
              0,
              [1, ['security_score', 'lethal_trifecta', 'finding_counts']]
            ],
            [
              'report',
              0,
              [
                1,
                [
                  ['summary', 0, [1, ['trust_note', 'exposure_note']]],
                  'resolved_findings',
                  ['method', 0, [1, ['out_of_scope']]]
                ]
              ]
            ],
            'started_at',
            'completed_at',
            'created_at'
          ]
        ]
      ],
      [
        'in_progress_revision',
        1,
        [
          1,
          [
            'security_review_id',
            'skill_version_id',
            'block_reason',
            'ai_generated',
            [
              'scores',
              0,
              [1, ['security_score', 'lethal_trifecta', 'finding_counts']]
            ],
            [
              'report',
              0,
              [
                1,
                [
                  ['summary', 0, [1, ['trust_note', 'exposure_note']]],
                  'resolved_findings',
                  ['method', 0, [1, ['out_of_scope']]]
                ]
              ]
            ],
            'started_at',
            'completed_at',
            'created_at'
          ]
        ]
      ],
      'created_at',
      'updated_at'
    ],
    1
  );
