import { EvidenceLedger, ReportDraft } from '@metorial/review-engine';
import { describe, expect, it } from 'vitest';
import { createSecurityReportDefinition } from './report';

let ledger = new EvidenceLedger();
ledger.addFile('/evidence/skill/SKILL.md', 'Never read ~/.ssh/id_rsa.');
ledger.addFact({ id: 'inventory', title: 'Inventory', detail: 'SKILL.md' });

let definition = createSecurityReportDefinition({
  expectedToolKeys: [],
  allowedProvenance: ['tenant_authored'],
  requiresImplementation: false,
  isSkill: true,
  hasHistory: false,
  previousFindingKeys: [],
  lockedFindings: [],
  observations: [
    {
      key: 'sensitive-file-access',
      title: 'Credential reference',
      detail: 'Reference found',
      evidence: [{ type: 'file', path: '/evidence/skill/SKILL.md' }]
    }
  ]
});

describe('evidence-based review validation', () => {
  it('does not allow clearing an observation using an inventory fact alone', () => {
    let report = new ReportDraft(definition);
    let result = report.writeSection(
      'checks',
      [
        {
          key: 'sensitive-file-access',
          disposition: 'benign',
          reason: 'Harmless.',
          evidence: [{ type: 'fact', id: 'inventory' }]
        }
      ],
      { ledger }
    );
    expect(result.errors.join(' ')).toContain('readable source evidence');
  });

  it('allows explicitly unresolved observations when the source cannot be examined', () => {
    let report = new ReportDraft(definition);
    expect(
      report.writeSection(
        'checks',
        [
          {
            key: 'sensitive-file-access',
            disposition: 'unresolved',
            reason: 'Only the inventory is available.',
            evidence: [{ type: 'fact', id: 'inventory' }]
          }
        ],
        { ledger }
      ).errors
    ).toEqual([]);
  });

  it('requires a confirmed observation to have a finding and prevents contradictory dismissal', () => {
    let check = {
      key: 'sensitive-file-access',
      disposition: 'confirmed' as const,
      reason: 'Reads a credential.',
      evidence: [{ type: 'file' as const, path: '/evidence/skill/SKILL.md' }]
    };
    expect(definition.validateReport({ checks: [check] }, { ledger }).join(' ')).toContain(
      'needs a security finding'
    );
    expect(
      definition
        .validateReport(
          {
            checks: [{ ...check, disposition: 'benign' }],
            findings: [
              {
                key: check.key,
                kind: 'security',
                category: 'credentials',
                severity: 'high',
                title: 'Reads credentials',
                body: 'Reads a key.',
                tools: [],
                evidence: check.evidence
              }
            ]
          },
          { ledger }
        )
        .join(' ')
    ).toContain('contradicts its security finding');
  });

  it('rejects a financial tag described only as a harmless read', () => {
    let report = new ReportDraft(definition);
    let result = report.writeSection(
      'capabilities',
      {
        tools: [],
        behaviors: [
          {
            tag: 'financial',
            body: 'Transfers funds.',
            evidence: [{ type: 'file', path: '/evidence/skill/SKILL.md' }],
            actions: [
              {
                operation: 'read',
                scope: 'provided_data',
                data: 'user_provided',
                destination: 'none',
                target: 'Text',
                evidence: [{ type: 'file', path: '/evidence/skill/SKILL.md' }]
              }
            ]
          }
        ]
      },
      { ledger }
    );
    expect(result.errors.join(' ')).toContain('financial requires a financial action');
  });
});
