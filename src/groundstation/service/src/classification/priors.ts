import type { Organization, Prisma } from '../../prisma/generated/client';
import { db } from '../db';
import type { StoreCollections } from '../store/connection';
import type { ManualAssignment, SessionDocument } from '../store/derivedModels';
import type { ClassifierFeatures } from '../types';
import type { PriorEvidence } from './stages';

let maxLabels = 200;
let maxManualSessions = 100;

export let featureIds = (features: ClassifierFeatures, key: 'repoIds' | 'workspaceIds') => {
  let value = features[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item == 'string')
    : [];
};

export let labelEvidenceFilter = (d: {
  workspaceIds: string[];
  repoIds: string[];
}): Prisma.ClassifierLabelWhereInput[] => [
  ...d.workspaceIds.map(id => ({
    features: { path: ['workspaceIds'], array_contains: [id] }
  })),
  ...d.repoIds.map(id => ({ features: { path: ['repoIds'], array_contains: [id] } }))
];

export let latestManualAssignments = (manual: ManualAssignment[]) => {
  let latest = new Map<string, ManualAssignment>();
  for (let entry of manual) {
    let current = latest.get(entry.kind);
    if (!current || new Date(entry.at).getTime() >= new Date(current.at).getTime()) {
      latest.set(entry.kind, entry);
    }
  }

  return new Map([...latest].map(([kind, entry]) => [kind, entry.entityId]));
};

let evidenceVia = (
  sessionWorkspaceIds: string[],
  workspaceIds: string[]
): PriorEvidence['via'] =>
  workspaceIds.some(id => sessionWorkspaceIds.includes(id)) ? 'workspace' : 'repo';

export let loadPriorEvidence = async (d: {
  organization: Organization;
  session: SessionDocument;
  kinds: string[];
  collections: StoreCollections;
}) => {
  let evidence = new Map<string, PriorEvidence[]>();
  let workspaceIds = d.session.context?.workspaceIds ?? [];
  let repoIds = d.session.context?.repoIds ?? [];
  if (!d.kinds.length || (!workspaceIds.length && !repoIds.length)) return evidence;

  let add = (kind: string, item: PriorEvidence) => {
    let list = evidence.get(kind) ?? [];
    list.push(item);
    evidence.set(kind, list);
  };

  let [labels, manualSessions] = await Promise.all([
    db.classifierLabel.findMany({
      where: {
        organizationOid: d.organization.oid,
        kind: { in: d.kinds },
        sessionKey: { not: d.session._id },
        entity: { status: 'managed' },
        OR: labelEvidenceFilter({ workspaceIds, repoIds })
      },
      orderBy: { createdAt: 'desc' },
      take: maxLabels,
      include: { entity: true }
    }),
    d.collections.sessions
      .find(
        {
          organizationId: d.session.organizationId,
          _id: { $ne: d.session._id },
          'attribution.dimIds': { $in: [...workspaceIds, ...repoIds] },
          manual: { $elemMatch: { kind: { $in: d.kinds }, entityId: { $type: 'string' } } }
        },
        {
          sort: { startedAt: -1 },
          limit: maxManualSessions,
          projection: { context: 1, manual: 1 }
        }
      )
      .toArray()
  ]);

  let labelled = new Set<string>();

  for (let label of labels) {
    labelled.add(`${label.sessionKey}\0${label.kind}`);
    add(label.kind, {
      entityId: label.entity.id,
      via: evidenceVia(workspaceIds, featureIds(label.features, 'workspaceIds'))
    });
  }

  for (let session of manualSessions) {
    for (let [kind, entityId] of latestManualAssignments(session.manual ?? [])) {
      if (!entityId || !d.kinds.includes(kind)) continue;
      if (labelled.has(`${session._id}\0${kind}`)) continue;

      add(kind, {
        entityId,
        via: evidenceVia(workspaceIds, session.context?.workspaceIds ?? [])
      });
    }
  }

  return evidence;
};
