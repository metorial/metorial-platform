import type { Provider, ProviderVersion, Slate, SlateVersion } from '@metorial-subspace/db';
import { slatesClient } from '@metorial-subspace/provider-slates';
import type { LedgerFact } from '@metorial/review-engine';
import type { CollectedEvidence } from '../evidence';
import { scanToolDefinitions } from './protoguard';
import { loadSpecification } from './specification';

let MAX_DOCUMENT_CHARS = 100_000;
let MAX_DOCUMENTS = 40;

let documentPath = (path: string) =>
  `docs/${path
    .replace(/^\/+/, '')
    .replace(/\.\.+/g, '.')
    .replace(/[^\w./-]+/g, '_')}`;

let loadRegistryDocuments = async (d: { slate: Slate; slateVersion: SlateVersion }) => {
  try {
    let record = await slatesClient.slateVersion.getRegistryRecord({
      slateId: d.slate.id,
      slateVersionId: d.slateVersion.id
    });

    let documents = ((record.documents ?? []) as { path: string; content: string }[])
      .filter(document => typeof document.content == 'string')
      .slice(0, MAX_DOCUMENTS);

    return Object.fromEntries(
      documents.map(document => [
        documentPath(document.path),
        document.content.slice(0, MAX_DOCUMENT_CHARS)
      ])
    );
  } catch {
    return null;
  }
};

export let collectSlateEvidence = async (d: {
  provider: Provider;
  providerVersion: ProviderVersion;
  slate: Slate;
  slateVersion: SlateVersion;
}): Promise<CollectedEvidence> => {
  let [specification, documents] = await Promise.all([
    loadSpecification(d.providerVersion.specificationOid),
    loadRegistryDocuments(d)
  ]);

  let tools = specification?.tools ?? null;
  let poisoning = scanToolDefinitions(tools ?? []);

  let facts: LedgerFact[] = [
    {
      id: 'metorial-origin',
      title: 'Built and operated by Metorial',
      detail: `${d.provider.name} is a first-party Metorial integration (${d.slate.identifierInRegistry ?? d.slate.identifier}, version ${d.slateVersion.version}). Its source is published in the Metorial registry and it runs on Metorial infrastructure.`
    },
    ...(specification?.unusedScopes.length
      ? [
          {
            id: 'unused-oauth-scopes',
            title: 'OAuth scopes that no tool requires',
            detail: specification.unusedScopes
              .map(
                entry =>
                  `${entry.method}: ${entry.unused.length} of ${entry.requested} requested scopes are not required by any tool (${entry.unused.join(', ')})`
              )
              .join('\n')
          }
        ]
      : []),
    ...poisoning.facts
  ];

  let limitations: string[] = [];
  if (!tools)
    limitations.push('The tool specification for this version has not been discovered yet.');

  return {
    kind: 'slate',
    title: d.provider.name,
    description: d.provider.description ?? '',
    files: {
      ...(specification?.files ?? {}),
      ...(documents ?? {})
    },
    codeFiles: {},
    tools,
    facts,
    findings: poisoning.findings,
    allowedProvenance: ['metorial_built'],
    fallbackProvenance: 'metorial_built',
    specificationOid: specification?.oid,
    limitations,
    outOfScope: [
      `${d.provider.name}'s own server-side permission enforcement`,
      'How the connecting agent or client applies permissions and asks for approval'
    ]
  };
};
