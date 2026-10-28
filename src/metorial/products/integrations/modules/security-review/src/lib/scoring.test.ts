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
  it('starts from the provenance base', () => {
    expect(computeSecurityScore({ provenance: 'metorial_built', findings: [] })).toBe(95);
    expect(
      computeSecurityScore({ provenance: 'tenant_remote_unverifiable', findings: [] })
    ).toBe(45);
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

  it('subtracts 15 per high finding and caps at 60', () => {
    expect(
      computeSecurityScore({
        provenance: 'metorial_built',
        findings: [finding('security', 'high')]
      })
    ).toBe(60);
    expect(
      computeSecurityScore({
        provenance: 'tenant_code',
        findings: [finding('security', 'high'), finding('security', 'high')]
      })
    ).toBe(50);
  });

  it('caps medium and low deductions', () => {
    let mediums = Array.from({ length: 6 }, () => finding('security', 'medium'));
    expect(computeSecurityScore({ provenance: 'metorial_built', findings: mediums })).toBe(71);

    let lows = Array.from({ length: 10 }, () => finding('security', 'low'));
    expect(computeSecurityScore({ provenance: 'metorial_built', findings: lows })).toBe(87);
  });

  it('adds positives only for tenant subjects, capped at +10 and 98', () => {
    let positives = Array.from({ length: 8 }, () => finding('positive'));
    expect(computeSecurityScore({ provenance: 'tenant_code', findings: positives })).toBe(90);
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

  it('ignores capability findings', () => {
    expect(
      computeSecurityScore({
        provenance: 'tenant_code',
        findings: [finding('capability', 'info')]
      })
    ).toBe(80);
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
  it('is the max of posture and exposure', () => {
    expect(computeRisk({ postureRisk: 'low', exposure: 'high' })).toBe('high');
    expect(computeRisk({ postureRisk: 'low', exposure: 'low' })).toBe('low');
  });

  it('raises one tier when both are at least moderate', () => {
    expect(computeRisk({ postureRisk: 'moderate', exposure: 'high' })).toBe('critical');
    expect(computeRisk({ postureRisk: 'moderate', exposure: 'moderate' })).toBe('high');
  });

  it('rates first-party code by its posture, not by what its tools can do', () => {
    expect(
      computeRisk({ postureRisk: 'low', exposure: 'critical', provenance: 'metorial_built' })
    ).toBe('low');
    expect(
      computeRisk({ postureRisk: 'high', exposure: 'low', provenance: 'metorial_built' })
    ).toBe('high');
    expect(
      computeRisk({ postureRisk: 'low', exposure: 'critical', provenance: 'tenant_code' })
    ).toBe('critical');
  });

  it('treats unknown exposure as moderate', () => {
    expect(computeRisk({ postureRisk: 'low', exposure: 'unknown' })).toBe('moderate');
  });
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

  it('drops one level per gap', () => {
    expect(computeConfidence({ provenance: 'tenant_code', coverage: fullCoverage })).toBe(
      'high'
    );
    expect(
      computeConfidence({
        provenance: 'tenant_code',
        coverage: { ...fullCoverage, toolsReviewed: 1 }
      })
    ).toBe('medium');
    expect(
      computeConfidence({
        provenance: 'tenant_code',
        coverage: { ...fullCoverage, toolsReviewed: 1, codeReadable: false }
      })
    ).toBe('low');
  });

  it('never rates container images above medium', () => {
    expect(computeConfidence({ provenance: 'tenant_image', coverage: fullCoverage })).toBe(
      'medium'
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
    expect(scores.headline).toEqual(['Trusted implementation.', 'Powerful permissions.']);
    expect(scores.counts.capabilities).toEqual({ read: 1, write: 0, destructive: 1 });
  });

  it('keeps tenant code at the higher of posture and exposure', () => {
    let scores = computeScores({
      provenance: 'tenant_code',
      tools: [tool('read'), tool('write', 'destructive')],
      findings: [],
      coverage: fullCoverage
    });

    expect(scores.risk).toBe('critical');
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
