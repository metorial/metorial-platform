import type {
  SecurityControlKey,
  SecurityFindingCategoryKey,
  SecurityLedgerRef,
  SecurityReportControl,
  SecurityReportFinding
} from '@metorial-subspace/db';
import { controlsFor } from '../definitions/controls';
import type { EvidenceTool, SubjectKind } from './evidence';

let platformReasons: Partial<Record<SubjectKind, string>> = {
  slate: 'Guaranteed by Metorial for every integration it builds and operates.',
  function: 'Functions are served by Metorial over HTTPS.',
  container: 'Containers are served by Metorial over HTTPS.'
};

// A confirmed defect in the area a control covers contradicts a "met" assessment of it.
let contradictingCategories: Partial<
  Record<SecurityControlKey, SecurityFindingCategoryKey[]>
> = {
  input_scoping: ['input_validation'],
  destination_restriction: ['exfiltration'],
  egress_restriction: ['exfiltration'],
  secret_hygiene: ['secrets', 'credentials'],
  credential_isolation: ['secrets', 'credentials'],
  least_privilege_access: ['excessive_scope', 'over_privilege'],
  minimal_permissions: ['excessive_scope', 'over_privilege'],
  dependency_hygiene: ['dependencies', 'supply_chain'],
  transport_security: ['transport'],
  transparent_content: ['hidden_content', 'opaque_content'],
  scoped_activation: ['trigger_abuse']
};

let annotationControl = (d: {
  tools: EvidenceTool[];
  findings: SecurityReportFinding[];
}): SecurityReportControl => {
  let evidence: SecurityLedgerRef[] = d.tools.slice(0, 5).map(tool => ({
    type: 'tool',
    key: tool.key
  }));
  let declared = d.tools.filter(tool =>
    Object.values(tool.hints).some(value => value !== undefined)
  );
  let mismatched = d.findings.some(
    finding =>
      finding.kind == 'security' &&
      finding.category == 'annotation_mismatch' &&
      finding.severity != 'info'
  );

  if (mismatched)
    return {
      key: 'accurate_annotations',
      disposition: 'not_met',
      reason: 'At least one tool declares hints that contradict its behavior.',
      evidence,
      source: 'platform'
    };

  if (d.tools.length && declared.length == d.tools.length)
    return {
      key: 'accurate_annotations',
      disposition: 'met',
      reason: 'Every tool declares hints and none contradicts its behavior.',
      evidence,
      source: 'platform'
    };

  return {
    key: 'accurate_annotations',
    disposition: 'partial',
    reason: declared.length
      ? `${declared.length} of ${d.tools.length} tools declare hints.`
      : 'No tool declares read-only or destructive hints.',
    evidence,
    source: 'platform'
  };
};

let transportControl = (encrypted: boolean): SecurityReportControl => ({
  key: 'transport_security',
  disposition: encrypted ? 'met' : 'not_met',
  reason: encrypted
    ? 'The endpoint is reached over HTTPS.'
    : 'The endpoint is reached over unencrypted HTTP.',
  evidence: [{ type: 'fact', id: 'remote-host' }],
  source: 'platform'
});

export let resolveControls = (d: {
  kind: SubjectKind;
  assessed: SecurityReportControl[] | undefined;
  tools: EvidenceTool[] | null;
  transportEncrypted?: boolean | null;
  findings: SecurityReportFinding[];
}): SecurityReportControl[] =>
  controlsFor(d.kind).flatMap((control): SecurityReportControl[] => {
    if (control.guaranteedFor?.includes(d.kind))
      return [
        {
          key: control.key,
          disposition: 'met',
          reason: platformReasons[d.kind] ?? control.description,
          evidence: d.kind == 'slate' ? [{ type: 'fact', id: 'metorial-origin' }] : [],
          source: 'platform'
        }
      ];

    if (control.key == 'accurate_annotations' && d.tools)
      return [annotationControl({ tools: d.tools, findings: d.findings })];

    if (control.key == 'transport_security' && typeof d.transportEncrypted == 'boolean')
      return [transportControl(d.transportEncrypted)];

    let assessed = d.assessed?.find(item => item.key == control.key);
    if (!assessed) return [];

    let contradicted = d.findings.some(
      finding =>
        finding.kind == 'security' &&
        finding.severity != 'info' &&
        (contradictingCategories[control.key] ?? []).includes(finding.category)
    );

    return [
      {
        ...assessed,
        disposition:
          contradicted && assessed.disposition == 'met' ? 'partial' : assessed.disposition,
        source: 'agent'
      }
    ];
  });
