import { db, type SecurityReportFinding } from '@metorial-subspace/db';
import type { LedgerFact } from '@metorial/review-engine';
import { CENSUS_WINDOW_DAYS, type CensusObservation, classifySpecCensus } from '../specCensus';
import { loadSpecification } from './specification';

let MAX_OBSERVATIONS = 500;

export let computeSpecCensus = async (d: { providerVersionOid: bigint }) => {
  let since = new Date(Date.now() - CENSUS_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  let [connections, pairs] = await Promise.all([
    db.sessionConnectionProviderSpecification.findMany({
      where: {
        providerVersionOid: d.providerVersionOid,
        specificationOid: { not: null },
        createdAt: { gte: since }
      },
      orderBy: { createdAt: 'desc' },
      take: MAX_OBSERVATIONS,
      select: {
        specificationOid: true,
        createdAt: true,
        discoveredAt: true,
        sessionProvider: { select: { authConfigOid: true, deploymentOid: true } }
      }
    }),
    db.providerDeploymentConfigPairProviderVersion.findMany({
      where: {
        versionOid: d.providerVersionOid,
        specificationOid: { not: null },
        createdAt: { gte: since }
      },
      orderBy: { createdAt: 'desc' },
      take: MAX_OBSERVATIONS,
      select: { specificationOid: true, createdAt: true, pairOid: true }
    })
  ]);

  let raw = [
    ...connections.map(row => ({
      specificationOid: row.specificationOid!,
      observedAt: row.discoveredAt ?? row.createdAt,
      credentialKey: row.sessionProvider.authConfigOid
        ? `auth:${row.sessionProvider.authConfigOid}`
        : `deployment:${row.sessionProvider.deploymentOid}`
    })),
    ...pairs.map(row => ({
      specificationOid: row.specificationOid!,
      observedAt: row.createdAt,
      credentialKey: `pair:${row.pairOid}`
    }))
  ];

  if (!raw.length) return null;

  let specifications = new Map(
    await Promise.all(
      [...new Set(raw.map(row => row.specificationOid))].map(
        async oid => [oid, await loadSpecification(oid)] as const
      )
    )
  );

  let observations: CensusObservation[] = raw.flatMap(row => {
    let specification = specifications.get(row.specificationOid);
    if (!specification) return [];

    return [
      {
        credentialKey: row.credentialKey,
        observedAt: row.observedAt,
        tools: specification.tools.map(tool => ({
          key: tool.key,
          description: tool.description,
          inputSchema: tool.inputSchema,
          annotations: tool.annotations
        }))
      }
    ];
  });

  return classifySpecCensus({ observations });
};

export let censusFindings = (
  census: NonNullable<Awaited<ReturnType<typeof computeSpecCensus>>>
) => {
  let facts: LedgerFact[] = [];
  let findings: SecurityReportFinding[] = [];

  if (census.classification == 'divergent_definitions') {
    facts.push({
      id: 'census-divergent',
      title: 'Tool definitions differ between connections',
      detail: `Tools with different definitions for different credentials: ${census.divergentTools.join(', ')}`
    });

    findings.push({
      key: 'spec-divergent-definitions',
      kind: 'security',
      category: 'spec_variance',
      severity: 'high',
      title: 'The server shows different tool definitions to different accounts',
      body: `Within the last ${census.windowDays} days, ${census.divergentTools.join(', ')} had different descriptions or schemas depending on the connected account. A server can use this to show a reviewed definition to some users and a different one to others.`,
      recommendation: 'Confirm with the operator why tool definitions vary per account.',
      tools: census.divergentTools,
      evidence: [{ type: 'fact', id: 'census-divergent' }]
    });
  }

  if (census.classification == 'disjoint') {
    facts.push({
      id: 'census-disjoint',
      title: 'Connections see largely different tool sets',
      detail: `${census.hashes.length} distinct tool sets with little overlap were observed.`
    });

    findings.push({
      key: 'spec-disjoint-tool-sets',
      kind: 'security',
      category: 'spec_variance',
      severity: 'medium',
      title: 'Different accounts see different servers',
      body: `Connections to this provider observed ${census.hashes.length} tool sets that barely overlap, which suggests different servers or builds behind the same address.`,
      recommendation: 'Make sure every account connects to the same server build.',
      tools: [],
      evidence: [{ type: 'fact', id: 'census-disjoint' }]
    });
  }

  if (census.classification == 'scoped_subset') {
    facts.push({
      id: 'census-scoped',
      title: 'Tool sets vary with account permissions',
      detail: `${census.hashes.length} tool sets were observed; each is a subset of the full set and shared tools are identical.`
    });

    findings.push({
      key: 'spec-scoped-subsets',
      kind: 'capability',
      category: 'spec_variance',
      severity: 'info',
      title: 'Available tools depend on the connected account',
      body: 'Accounts see different subsets of the same tools, consistent with permission-scoped access. This review covers the full set.',
      tools: [],
      evidence: [{ type: 'fact', id: 'census-scoped' }]
    });
  }

  return { facts, findings };
};
