import { describe, expect, it } from 'vitest';
import {
  bandForScore,
  computeConfidence,
  computeExposure,
  computeRisk,
  computeScores,
  computeSecurityScore
} from './scoring';

let finding = (kind: 'security' | 'capability' | 'positive', severity: any = 'info') => ({
  kind,
  severity
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

describe('security score', () => {
  it('does not confuse origin uncertainty with a confirmed security defect', () => {
    expect(computeSecurityScore({ provenance: 'metorial_built', findings: [] })).toBe(95);
    expect(
      computeSecurityScore({ provenance: 'tenant_remote_unverifiable', findings: [] })
    ).toBe(95);
  });

  it('caps impersonation at 10 regardless of positives', () => {
    let findings = Array.from({ length: 5 }, () => finding('positive'));
    expect(computeSecurityScore({ provenance: 'impersonation_suspected', findings })).toBe(10);
  });

  it('caps critical findings at 25', () => {
    expect(
      computeSecurityScore({
        provenance: 'metorial_built',
        findings: [finding('security', 'critical')]
      })
    ).toBe(25);
  });

  it('puts confirmed high-severity defects in the weak band', () => {
    expect(
      computeSecurityScore({
        provenance: 'metorial_built',
        findings: [finding('security', 'high')]
      })
    ).toBe(55);
    expect(
      computeSecurityScore({
        provenance: 'tenant_code',
        findings: [finding('security', 'high'), finding('security', 'high')]
      })
    ).toBe(55);
  });

  it('caps medium and low deductions', () => {
    let mediums = Array.from({ length: 6 }, () => finding('security', 'medium'));
    expect(computeSecurityScore({ provenance: 'metorial_built', findings: mediums })).toBe(71);

    let lows = Array.from({ length: 10 }, () => finding('security', 'low'));
    expect(computeSecurityScore({ provenance: 'metorial_built', findings: lows })).toBe(87);
  });

  it('does not reward a longer list of positive findings', () => {
    let positives = Array.from({ length: 8 }, () => finding('positive'));
    expect(computeSecurityScore({ provenance: 'tenant_code', findings: positives })).toBe(95);
    expect(
      computeSecurityScore({
        provenance: 'tenant_remote_vendor_verified',
        findings: positives
      })
    ).toBe(95);
    expect(computeSecurityScore({ provenance: 'metorial_built', findings: positives })).toBe(
      95
    );
  });

  it('gives identical reviewed clean skills the same strong quality across origins', () => {
    for (let provenance of [
      'imported_public_repo',
      'imported_private_repo',
      'forked'
    ] as const) {
      expect(bandForScore(computeSecurityScore({ provenance, findings: [] }))).toBe('strong');
    }
    expect(computeSecurityScore({ provenance: 'imported_public_repo', findings: [] })).toBe(
      95
    );
    expect(computeSecurityScore({ provenance: 'uploaded_archive', findings: [] })).toBe(95);
  });

  it('still penalizes findings on public-repo imports', () => {
    expect(
      computeSecurityScore({
        provenance: 'imported_public_repo',
        findings: [finding('security', 'high')]
      })
    ).toBe(55);
  });

  it('ignores capability findings', () => {
    expect(
      computeSecurityScore({
        provenance: 'tenant_code',
        findings: [finding('capability', 'info')]
      })
    ).toBe(95);
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
  it('builds the headline from band and exposure', () => {
    let scores = computeScores({
      provenance: 'metorial_built',
      tools: [tool('read'), tool('write', 'destructive')],
      findings: [],
      coverage: fullCoverage
    });

    expect(scores.security).toBe(95);
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

    expect(scores.security).toBe(95);
    expect(scores.exposure).toBe('low');
    expect(scores.risk).toBe('low');
    expect(scores.headline).toEqual([
      'No security issues found.',
      'Limited, scoped behavior.'
    ]);
  });
});
