import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceProvidersSecurityReviewGetOutput = {
  object: 'provider.security_review';
  id: string;
  providerId: string | null;
  providerVersionId: string | null;
  maintainedBy: 'metorial' | 'organization';
  status: 'active' | 'outdated' | 'disabled';
  currentRevision: {
    object: 'provider.security_review.revision';
    id: string;
    securityReviewId: string;
    providerVersionId: string | null;
    number: number;
    status:
      | 'queued'
      | 'running'
      | 'completed'
      | 'completed_with_gaps'
      | 'failed'
      | 'blocked';
    stage: 'collecting' | 'verifying' | 'analyzing' | 'writing' | null;
    activity: string | null;
    blockReason: 'billing' | 'ai_disabled' | 'admin_disabled' | null;
    awaitingTools: boolean;
    aiGenerated: boolean;
    scores: {
      securityScore: number;
      band: 'strong' | 'good' | 'fair' | 'weak' | 'poor';
      exposure: 'unknown' | 'low' | 'moderate' | 'high' | 'critical';
      risk: 'low' | 'moderate' | 'high' | 'critical';
      confidence: 'low' | 'medium' | 'high';
      lethalTrifecta: boolean;
      headline: string[];
      counts: {
        toolsExpected: number;
        toolsReviewed: number;
        readTools: number;
        writeTools: number;
        destructiveTools: number;
        findings: {
          info: number;
          low: number;
          medium: number;
          high: number;
          critical: number;
        };
        positives: number;
      };
      previous: {
        securityScore: number;
        risk: 'unknown' | 'low' | 'moderate' | 'high' | 'critical';
      } | null;
    } | null;
    report: {
      summary: { text: string; trustNote: string; exposureNote: string } | null;
      provenance: {
        class:
          | 'metorial_built'
          | 'tenant_code'
          | 'tenant_image'
          | 'tenant_remote_vendor_verified'
          | 'tenant_remote_vendor_plausible'
          | 'tenant_remote_third_party'
          | 'tenant_remote_unverifiable'
          | 'impersonation_suspected';
        body: string;
        evidence: (
          | {
              type: 'file';
              path: string;
              lines: number[] | null;
              excerpt: string | null;
            }
          | { type: 'url'; url: string }
          | { type: 'tool'; toolKey: string }
          | { type: 'note'; label: string; detail: string | null }
        )[];
      } | null;
      capabilities: {
        tools: {
          key: string;
          name: string | null;
          tags: (
            | 'read'
            | 'write'
            | 'untrusted_input'
            | 'destructive'
            | 'external_send'
            | 'bulk_private_data'
            | 'access_control'
            | 'financial'
            | 'code_execution'
            | 'infrastructure'
          )[];
          behavior: string;
          declaredHints: {
            readOnly: boolean | null;
            destructive: boolean | null;
            idempotent: boolean | null;
            openWorld: boolean | null;
          };
          hintAccuracy: 'matches' | 'mismatch' | 'undeclared';
        }[];
      } | null;
      implementation: {
        strengths: {
          title: string;
          body: string;
          evidence: (
            | {
                type: 'file';
                path: string;
                lines: number[] | null;
                excerpt: string | null;
              }
            | { type: 'url'; url: string }
            | { type: 'tool'; toolKey: string }
            | { type: 'note'; label: string; detail: string | null }
          )[];
        }[];
        weaknesses: {
          title: string;
          body: string;
          evidence: (
            | {
                type: 'file';
                path: string;
                lines: number[] | null;
                excerpt: string | null;
              }
            | { type: 'url'; url: string }
            | { type: 'tool'; toolKey: string }
            | { type: 'note'; label: string; detail: string | null }
          )[];
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
      toolKeys: string[];
      evidence: (
        | {
            type: 'file';
            path: string;
            lines: number[] | null;
            excerpt: string | null;
          }
        | { type: 'url'; url: string }
        | { type: 'tool'; toolKey: string }
        | { type: 'note'; label: string; detail: string | null }
      )[];
    }[];
    startedAt: Date | null;
    completedAt: Date | null;
    createdAt: Date;
  } | null;
  inProgressRevision: {
    object: 'provider.security_review.revision';
    id: string;
    securityReviewId: string;
    providerVersionId: string | null;
    number: number;
    status:
      | 'queued'
      | 'running'
      | 'completed'
      | 'completed_with_gaps'
      | 'failed'
      | 'blocked';
    stage: 'collecting' | 'verifying' | 'analyzing' | 'writing' | null;
    activity: string | null;
    blockReason: 'billing' | 'ai_disabled' | 'admin_disabled' | null;
    awaitingTools: boolean;
    aiGenerated: boolean;
    scores: {
      securityScore: number;
      band: 'strong' | 'good' | 'fair' | 'weak' | 'poor';
      exposure: 'unknown' | 'low' | 'moderate' | 'high' | 'critical';
      risk: 'low' | 'moderate' | 'high' | 'critical';
      confidence: 'low' | 'medium' | 'high';
      lethalTrifecta: boolean;
      headline: string[];
      counts: {
        toolsExpected: number;
        toolsReviewed: number;
        readTools: number;
        writeTools: number;
        destructiveTools: number;
        findings: {
          info: number;
          low: number;
          medium: number;
          high: number;
          critical: number;
        };
        positives: number;
      };
      previous: {
        securityScore: number;
        risk: 'unknown' | 'low' | 'moderate' | 'high' | 'critical';
      } | null;
    } | null;
    report: {
      summary: { text: string; trustNote: string; exposureNote: string } | null;
      provenance: {
        class:
          | 'metorial_built'
          | 'tenant_code'
          | 'tenant_image'
          | 'tenant_remote_vendor_verified'
          | 'tenant_remote_vendor_plausible'
          | 'tenant_remote_third_party'
          | 'tenant_remote_unverifiable'
          | 'impersonation_suspected';
        body: string;
        evidence: (
          | {
              type: 'file';
              path: string;
              lines: number[] | null;
              excerpt: string | null;
            }
          | { type: 'url'; url: string }
          | { type: 'tool'; toolKey: string }
          | { type: 'note'; label: string; detail: string | null }
        )[];
      } | null;
      capabilities: {
        tools: {
          key: string;
          name: string | null;
          tags: (
            | 'read'
            | 'write'
            | 'untrusted_input'
            | 'destructive'
            | 'external_send'
            | 'bulk_private_data'
            | 'access_control'
            | 'financial'
            | 'code_execution'
            | 'infrastructure'
          )[];
          behavior: string;
          declaredHints: {
            readOnly: boolean | null;
            destructive: boolean | null;
            idempotent: boolean | null;
            openWorld: boolean | null;
          };
          hintAccuracy: 'matches' | 'mismatch' | 'undeclared';
        }[];
      } | null;
      implementation: {
        strengths: {
          title: string;
          body: string;
          evidence: (
            | {
                type: 'file';
                path: string;
                lines: number[] | null;
                excerpt: string | null;
              }
            | { type: 'url'; url: string }
            | { type: 'tool'; toolKey: string }
            | { type: 'note'; label: string; detail: string | null }
          )[];
        }[];
        weaknesses: {
          title: string;
          body: string;
          evidence: (
            | {
                type: 'file';
                path: string;
                lines: number[] | null;
                excerpt: string | null;
              }
            | { type: 'url'; url: string }
            | { type: 'tool'; toolKey: string }
            | { type: 'note'; label: string; detail: string | null }
          )[];
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
      toolKeys: string[];
      evidence: (
        | {
            type: 'file';
            path: string;
            lines: number[] | null;
            excerpt: string | null;
          }
        | { type: 'url'; url: string }
        | { type: 'tool'; toolKey: string }
        | { type: 'note'; label: string; detail: string | null }
      )[];
    }[];
    startedAt: Date | null;
    completedAt: Date | null;
    createdAt: Date;
  } | null;
  lastCheckedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstanceProvidersSecurityReviewGetOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceProvidersSecurityReviewGetOutput>(
    [
      'provider_id',
      'provider_version_id',
      'maintained_by',
      [
        'current_revision',
        1,
        [
          1,
          [
            'security_review_id',
            'provider_version_id',
            'block_reason',
            'awaiting_tools',
            'ai_generated',
            [
              'scores',
              0,
              [
                1,
                [
                  'security_score',
                  'lethal_trifecta',
                  [
                    'counts',
                    0,
                    [
                      1,
                      [
                        'tools_expected',
                        'tools_reviewed',
                        'read_tools',
                        'write_tools',
                        'destructive_tools'
                      ]
                    ]
                  ],
                  ['previous', 0, [1, ['security_score']]]
                ]
              ]
            ],
            [
              'report',
              0,
              [
                1,
                [
                  ['summary', 0, [1, ['trust_note', 'exposure_note']]],
                  [
                    'provenance',
                    0,
                    [1, [['evidence', 0, [2, [3, [[0, [1, ['tool_key']]]]]]]]]
                  ],
                  [
                    'capabilities',
                    0,
                    [
                      1,
                      [
                        [
                          'tools',
                          0,
                          [
                            2,
                            [
                              1,
                              [
                                [
                                  'declared_hints',
                                  1,
                                  [1, ['read_only', 'open_world']]
                                ],
                                'hint_accuracy'
                              ]
                            ]
                          ]
                        ]
                      ]
                    ]
                  ],
                  [
                    'implementation',
                    0,
                    [
                      1,
                      [
                        [
                          'strengths',
                          0,
                          [
                            2,
                            [
                              1,
                              [
                                [
                                  'evidence',
                                  0,
                                  [2, [3, [[0, [1, ['tool_key']]]]]]
                                ]
                              ]
                            ]
                          ]
                        ],
                        [
                          'weaknesses',
                          0,
                          [
                            2,
                            [
                              1,
                              [
                                [
                                  'evidence',
                                  0,
                                  [2, [3, [[0, [1, ['tool_key']]]]]]
                                ]
                              ]
                            ]
                          ]
                        ]
                      ]
                    ]
                  ],
                  'resolved_findings',
                  ['method', 0, [1, ['out_of_scope']]]
                ]
              ]
            ],
            [
              'findings',
              0,
              [
                2,
                [
                  1,
                  [
                    'tool_keys',
                    ['evidence', 0, [2, [3, [[0, [1, ['tool_key']]]]]]]
                  ]
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
            'provider_version_id',
            'block_reason',
            'awaiting_tools',
            'ai_generated',
            [
              'scores',
              0,
              [
                1,
                [
                  'security_score',
                  'lethal_trifecta',
                  [
                    'counts',
                    0,
                    [
                      1,
                      [
                        'tools_expected',
                        'tools_reviewed',
                        'read_tools',
                        'write_tools',
                        'destructive_tools'
                      ]
                    ]
                  ],
                  ['previous', 0, [1, ['security_score']]]
                ]
              ]
            ],
            [
              'report',
              0,
              [
                1,
                [
                  ['summary', 0, [1, ['trust_note', 'exposure_note']]],
                  [
                    'provenance',
                    0,
                    [1, [['evidence', 0, [2, [3, [[0, [1, ['tool_key']]]]]]]]]
                  ],
                  [
                    'capabilities',
                    0,
                    [
                      1,
                      [
                        [
                          'tools',
                          0,
                          [
                            2,
                            [
                              1,
                              [
                                [
                                  'declared_hints',
                                  1,
                                  [1, ['read_only', 'open_world']]
                                ],
                                'hint_accuracy'
                              ]
                            ]
                          ]
                        ]
                      ]
                    ]
                  ],
                  [
                    'implementation',
                    0,
                    [
                      1,
                      [
                        [
                          'strengths',
                          0,
                          [
                            2,
                            [
                              1,
                              [
                                [
                                  'evidence',
                                  0,
                                  [2, [3, [[0, [1, ['tool_key']]]]]]
                                ]
                              ]
                            ]
                          ]
                        ],
                        [
                          'weaknesses',
                          0,
                          [
                            2,
                            [
                              1,
                              [
                                [
                                  'evidence',
                                  0,
                                  [2, [3, [[0, [1, ['tool_key']]]]]]
                                ]
                              ]
                            ]
                          ]
                        ]
                      ]
                    ]
                  ],
                  'resolved_findings',
                  ['method', 0, [1, ['out_of_scope']]]
                ]
              ]
            ],
            [
              'findings',
              0,
              [
                2,
                [
                  1,
                  [
                    'tool_keys',
                    ['evidence', 0, [2, [3, [[0, [1, ['tool_key']]]]]]]
                  ]
                ]
              ]
            ],
            'started_at',
            'completed_at',
            'created_at'
          ]
        ]
      ],
      'last_checked_at',
      'created_at',
      'updated_at'
    ],
    1
  );

export type DashboardInstanceProvidersSecurityReviewGetQuery = {
  providerVersionId?: string | undefined;
};

export let mapDashboardInstanceProvidersSecurityReviewGetQuery =
  /* @__PURE__ */ mapObject<DashboardInstanceProvidersSecurityReviewGetQuery>([
    'provider_version_id'
  ]);
