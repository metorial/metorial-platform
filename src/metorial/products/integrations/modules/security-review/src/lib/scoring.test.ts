import { describe, expect, it } from 'vitest';
import type {
  SecurityControlDisposition,
  SecurityControlKey,
  SecurityFindingCategoryKey
} from '@metorial-subspace/db';
import { assessableControlsFor } from '../definitions/controls';
import { resolveControls } from './controls';
import type { SubjectKind } from './evidence';
import {
  assuranceFactor,
  bandForScore,
  computeConfidence,
  computeExposure,
  computeRisk,
  computeScores,
  computeSecurityScore
} from './scoring';

let finding = (kind: 'security' | 'capability' | 'positive', severity: any = 'info') => ({
  kind,
  severity,
  category: 'implementation' as SecurityFindingCategoryKey
});

let tool = (...tags: any[]) => ({
  key: tags.join('_'),
  tags,
  behavior: '',
  declaredHints: {},
  hintAccuracy: 'undeclared' as const
});

let fullCoverage = {
  toolsExpected: 2,
  toolsReviewed: 2,
  budgetExhausted: false,
  awaitingTools: false
};

let securityFinding = (
  severity: 'low' | 'medium' | 'high' | 'critical',
  category: SecurityFindingCategoryKey = 'implementation'
) => ({ kind: 'security' as const, severity, category });

let controls = (
  kind: SubjectKind,
  dispositions: Partial<Record<SecurityControlKey, SecurityControlDisposition>>
) =>
  resolveControls({
    kind,
    tools: null,
    findings: [],
    assessed: assessableControlsFor(kind).map(control => ({
      key: control.key,
      disposition: dispositions[control.key] ?? 'met',
      reason: 'Assessed.',
      evidence: []
    }))
  });

let slateGaps = controls('slate', {
  input_scoping: 'not_met',
  destination_restriction: 'not_met',
  destructive_targeting: 'not_met',
  untrusted_content_separation: 'not_met'
});

let typicalSlate = controls('slate', { untrusted_content_separation: 'partial' });

let typicalSkill = controls('skill', {
  egress_restriction: 'partial',
  safe_command_construction: 'not_met',
  credential_isolation: 'not_applicable',
  dependency_hygiene: 'not_met',
  destructive_confirmation: 'partial',
  minimal_permissions: 'partial'
});

let skillGaps = controls('skill', {
  path_scoping: 'not_met',
  egress_restriction: 'not_met',
  safe_command_construction: 'not_met',
  credential_isolation: 'not_met',
  dependency_hygiene: 'not_met',
  destructive_confirmation: 'not_met',
  minimal_permissions: 'not_met',
  transparent_content: 'partial',
  scoped_activation: 'partial'
});

let incomplete = assuranceFactor({
  provenance: 'imported_public_repo',
  complete: false,
  unresolvedObservations: 1,
  unclassifiedActions: false
});

describe('security score', () => {
  it('keeps Metorial integrations above 90 whatever their reach and hardening gaps', () => {
    expect(
      computeSecurityScore({
        provenance: 'metorial_built',
        findings: [],
        controls: typicalSlate,
        exposure: 'critical'
      })
    ).toBeGreaterThan(98);
    expect(
      computeSecurityScore({
        provenance: 'metorial_built',
        findings: [securityFinding('low'), securityFinding('low'), securityFinding('medium')],
        controls: slateGaps,
        exposure: 'critical'
      })
    ).toBeGreaterThan(90);
    expect(
      computeSecurityScore({
        provenance: 'metorial_built',
        findings: [securityFinding('critical')],
        controls: typicalSlate,
        exposure: 'high'
      })
    ).toBeGreaterThan(90);
  });

  it('still lets findings and gaps differentiate Metorial integrations', () => {
    let clean = computeSecurityScore({
      provenance: 'metorial_built',
      findings: [],
      controls: controls('slate', {}),
      exposure: 'high'
    });
    let withLow = computeSecurityScore({
      provenance: 'metorial_built',
      findings: [securityFinding('low')],
      controls: typicalSlate,
      exposure: 'high'
    });
    let withGaps = computeSecurityScore({
      provenance: 'metorial_built',
      findings: [securityFinding('medium')],
      controls: slateGaps,
      exposure: 'high'
    });

    expect(clean).toBeGreaterThan(withLow);
    expect(withLow).toBeGreaterThan(withGaps);
  });

  it('keeps good skills and integrations with small or medium mistakes above 80', () => {
    expect(
      computeSecurityScore({
        provenance: 'imported_public_repo',
        findings: [securityFinding('medium'), securityFinding('low')],
        controls: typicalSkill,
        exposure: 'high',
        assurance: incomplete
      })
    ).toBeGreaterThan(80);
    expect(
      computeSecurityScore({
        provenance: 'tenant_code',
        findings: [
          securityFinding('medium', 'input_validation'),
          securityFinding('medium'),
          securityFinding('low')
        ],
        controls: controls('function', {
          input_scoping: 'partial',
          secret_hygiene: 'partial'
        }),
        exposure: 'high'
      })
    ).toBeGreaterThan(80);
  });

  it('rewards met safeguards a little', () => {
    let hardened = computeSecurityScore({
      provenance: 'tenant_authored',
      findings: [],
      controls: controls('skill', {}),
      exposure: 'moderate'
    });
    let typical = computeSecurityScore({
      provenance: 'tenant_authored',
      findings: [],
      controls: typicalSkill,
      exposure: 'moderate'
    });

    expect(hardened).toBeGreaterThan(typical);
    expect(typical).toBeGreaterThan(90);
  });

  it('lets a single high-severity defect make a subject bad', () => {
    for (let provenance of [
      'tenant_code',
      'imported_public_repo',
      'tenant_authored'
    ] as const) {
      expect(
        computeSecurityScore({
          provenance,
          findings: [securityFinding('high')],
          controls: controls(provenance == 'tenant_code' ? 'function' : 'skill', {}),
          exposure: 'low'
        })
      ).toBeLessThan(50);
    }
  });

  it('drives badly implemented custom providers towards zero', () => {
    expect(
      computeSecurityScore({
        provenance: 'tenant_code',
        findings: [
          securityFinding('critical', 'input_validation'),
          securityFinding('critical', 'exfiltration'),
          securityFinding('high', 'secrets')
        ],
        controls: controls('function', {
          input_scoping: 'not_met',
          destination_restriction: 'not_met',
          secret_hygiene: 'not_met'
        }),
        exposure: 'critical'
      })
    ).toBeLessThanOrEqual(3);
  });

  it('puts impersonation and other deception at or near zero', () => {
    expect(
      computeSecurityScore({ provenance: 'impersonation_suspected', findings: [] })
    ).toBeLessThanOrEqual(3);
    expect(
      computeSecurityScore({
        provenance: 'impersonation_suspected',
        findings: [securityFinding('high', 'impersonation')]
      })
    ).toBe(0);
    expect(
      computeSecurityScore({
        provenance: 'tenant_remote_third_party',
        findings: [securityFinding('medium', 'tool_poisoning')]
      })
    ).toBeLessThanOrEqual(5);
    expect(
      computeSecurityScore({
        provenance: 'imported_public_repo',
        findings: [securityFinding('medium', 'reviewer_targeting')]
      })
    ).toBeLessThanOrEqual(5);
  });

  it('never raises the score when a finding is added', () => {
    let severities = ['low', 'medium', 'high', 'critical'] as const;
    for (let provenance of [
      'metorial_built',
      'tenant_code',
      'imported_public_repo'
    ] as const) {
      let findings: ReturnType<typeof securityFinding>[] = [];
      let previous = computeSecurityScore({ provenance, findings });
      for (let severity of [...severities, ...severities]) {
        findings = [...findings, securityFinding(severity)];
        let next = computeSecurityScore({ provenance, findings });
        expect(next).toBeLessThanOrEqual(previous);
        previous = next;
      }
    }
  });

  it('orders control dispositions met over partial over not met', () => {
    let score = (disposition: SecurityControlDisposition) =>
      computeSecurityScore({
        provenance: 'tenant_code',
        findings: [],
        controls: controls('function', {
          input_scoping: disposition,
          destination_restriction: disposition
        }),
        exposure: 'high'
      });

    expect(score('met')).toBeGreaterThan(score('partial'));
    expect(score('partial')).toBeGreaterThan(score('not_met'));
  });

  it('weighs a missing safeguard by the reach it guards', () => {
    let score = (exposure: 'low' | 'critical') =>
      computeSecurityScore({
        provenance: 'imported_public_repo',
        findings: [],
        controls: skillGaps,
        exposure
      });

    expect(score('low')).toBeGreaterThan(score('critical'));
  });

  it('separates sloppy skills from good ones without calling them malicious', () => {
    let score = computeSecurityScore({
      provenance: 'imported_public_repo',
      findings: [
        securityFinding('medium'),
        securityFinding('medium'),
        securityFinding('medium'),
        securityFinding('low')
      ],
      controls: skillGaps,
      exposure: 'critical',
      assurance: incomplete
    });

    expect(score).toBeLessThan(80);
    expect(score).toBeGreaterThan(50);
  });

  it('does not reward a longer list of positive findings', () => {
    let positives = Array.from({ length: 8 }, () => finding('positive'));
    expect(computeSecurityScore({ provenance: 'tenant_code', findings: positives })).toBe(
      computeSecurityScore({ provenance: 'tenant_code', findings: [] })
    );
  });

  it('ignores capability findings', () => {
    expect(
      computeSecurityScore({
        provenance: 'tenant_code',
        findings: [finding('capability', 'info')]
      })
    ).toBe(100);
  });
});

describe('assurance', () => {
  it('is ignored for Metorial integrations', () => {
    expect(
      assuranceFactor({
        provenance: 'metorial_built',
        complete: false,
        unresolvedObservations: 3,
        unclassifiedActions: true
      })
    ).toBe(1);
  });

  it('lowers the score for what could not be reviewed or verified', () => {
    let complete = assuranceFactor({
      provenance: 'tenant_code',
      complete: true,
      unresolvedObservations: 0,
      unclassifiedActions: false
    });
    let partial = assuranceFactor({
      provenance: 'tenant_code',
      complete: false,
      unresolvedObservations: 0,
      unclassifiedActions: false
    });
    let unverifiable = assuranceFactor({
      provenance: 'tenant_remote_unverifiable',
      complete: true,
      unresolvedObservations: 0,
      unclassifiedActions: false
    });

    expect(complete).toBe(1);
    expect(partial).toBeLessThan(complete);
    expect(unverifiable).toBeLessThan(complete);
    expect(unverifiable).toBeGreaterThan(0.9);
  });
});

describe('bands', () => {
  it('maps scores to bands', () => {
    expect([90, 89, 75, 74, 60, 59, 40, 39].map(bandForScore)).toEqual([
      'strong',
      'good',
      'good',
      'fair',
      'fair',
      'weak',
      'weak',
      'poor'
    ]);
  });
});

describe('exposure', () => {
  it('is unknown without tools and low for an empty tool set', () => {
    expect(computeExposure(null).exposure).toBe('unknown');
    expect(computeExposure([]).exposure).toBe('low');
  });

  it('takes the highest tag tier', () => {
    expect(computeExposure([tool('read'), tool('write', 'destructive')]).exposure).toBe(
      'high'
    );
    expect(computeExposure([tool('read'), tool('financial')]).exposure).toBe('critical');
  });

  it('raises one tier for the lethal trifecta across tools', () => {
    let result = computeExposure([
      tool('read', 'untrusted_input'),
      tool('read', 'bulk_private_data'),
      tool('external_send')
    ]);
    expect(result.trifecta).toBe(true);
    expect(result.exposure).toBe('critical');
  });
});

describe('risk', () => {
  it.each(['metorial_built', 'tenant_code', 'imported_public_repo'] as const)(
    'keeps confirmed defects separate from capability exposure for %s',
    provenance => {
      expect(computeRisk({ postureRisk: 'low', exposure: 'critical', provenance })).toBe(
        'low'
      );
      expect(computeRisk({ postureRisk: 'high', exposure: 'low', provenance })).toBe('high');
      expect(computeRisk({ postureRisk: 'moderate', exposure: 'unknown', provenance })).toBe(
        'moderate'
      );
    }
  );
});

describe('confidence', () => {
  it('is low while awaiting tools or over budget', () => {
    expect(
      computeConfidence({
        provenance: 'tenant_code',
        coverage: { ...fullCoverage, awaitingTools: true }
      })
    ).toBe('low');
    expect(
      computeConfidence({
        provenance: 'tenant_code',
        coverage: { ...fullCoverage, budgetExhausted: true }
      })
    ).toBe('low');
  });

  it('does not claim high confidence with unreviewed evidence', () => {
    expect(computeConfidence({ provenance: 'tenant_code', coverage: fullCoverage })).toBe(
      'high'
    );
    expect(
      computeConfidence({
        provenance: 'tenant_code',
        coverage: { ...fullCoverage, toolsReviewed: 1 }
      })
    ).toBe('low');
    expect(
      computeConfidence({
        provenance: 'tenant_code',
        coverage: { ...fullCoverage, toolsReviewed: 1, codeReadable: false }
      })
    ).toBe('low');
  });

  it('keeps opaque container implementations uncertain', () => {
    expect(computeConfidence({ provenance: 'tenant_image', coverage: fullCoverage })).toBe(
      'low'
    );
  });
});

describe('computeScores', () => {
  it('completes a supported report when the operator cannot be verified', () => {
    let scores = computeScores({
      provenance: 'tenant_remote_unverifiable',
      tools: [tool('read'), tool('write')],
      findings: [],
      coverage: fullCoverage
    });

    expect(scores).toMatchObject({
      confidence: 'low',
      assessmentComplete: true,
      security: 96
    });
    expect(scores.headline[0]).toBe('No security issues found.');
  });

  it('keeps a strong score with a low-severity finding without claiming zero issues', () => {
    let scores = computeScores({
      provenance: 'metorial_built',
      tools: [tool('read'), tool('write', 'destructive')],
      findings: [
        {
          key: 'spec-variance',
          kind: 'security',
          category: 'spec_variance',
          severity: 'low',
          title: 'Unavailable operation',
          body: 'The description lists an operation that the tools do not support.',
          tools: [],
          evidence: []
        }
      ],
      coverage: fullCoverage
    });

    expect(scores).toMatchObject({
      security: 99,
      band: 'strong',
      exposure: 'high',
      headline: ['Strong security quality.', 'Powerful permissions.'],
      counts: { findings: { low: 1 } },
      assessmentComplete: true
    });
  });

  it('builds the headline from band and exposure', () => {
    let scores = computeScores({
      provenance: 'metorial_built',
      tools: [tool('read'), tool('write', 'destructive')],
      findings: [],
      coverage: fullCoverage
    });

    expect(scores.security).toBe(100);
    expect(scores.exposure).toBe('high');
    expect(scores.risk).toBe('low');
    expect(scores.headline).toEqual(['No security issues found.', 'Powerful permissions.']);
    expect(scores.counts.capabilities).toEqual({ read: 1, write: 0, destructive: 1 });
  });

  it('preserves powerful exposure without inventing a defect in clean tenant code', () => {
    let scores = computeScores({
      provenance: 'tenant_code',
      tools: [tool('read'), tool('write', 'destructive')],
      findings: [],
      coverage: fullCoverage
    });

    expect(scores.risk).toBe('low');
    expect(scores.exposure).toBe('high');
  });

  it('counts read tools that touch private data as read', () => {
    let scores = computeScores({
      provenance: 'metorial_built',
      tools: [tool('read', 'bulk_private_data', 'untrusted_input'), tool('write')],
      findings: [],
      coverage: fullCoverage
    });

    expect(scores.counts.capabilities).toEqual({ read: 1, write: 1, destructive: 0 });
  });
});

describe('skill scoring', () => {
  it('rates a clean tenant-authored skill with subagents as low risk', () => {
    let scores = computeScores({
      provenance: 'tenant_authored',
      tools: [],
      behaviors: [{ tag: 'subagents', body: 'Delegates the documented task.', evidence: [] }],
      findings: [],
      coverage: fullCoverage
    });

    expect(scores.security).toBe(100);
    expect(scores.exposure).toBe('low');
    expect(scores.risk).toBe('low');
    expect(scores.headline).toEqual([
      'No security issues found.',
      'Limited, scoped behavior.'
    ]);
  });
});
