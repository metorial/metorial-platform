import { db, type Organization } from '@mtsrc/agent-tracking-db';
import type { LabelSource, ResolvedField } from '../catalog';

export type Label = Record<string, string | null>;

export type LabelTarget = { column: string; field: ResolvedField };

let maxLabelValues = 10_000;

let fetchLabels = async (
  organization: Organization,
  source: LabelSource,
  ids: string[]
): Promise<Map<string, Label>> => {
  let result = new Map<string, Label>();
  if (!ids.length) return result;

  let put = (rows: { id: string }[], label: (row: any) => Label) => {
    for (let row of rows) result.set(row.id, label(row));
  };

  switch (source) {
    case 'entity':
      put(
        await db.entity.findMany({
          where: { organizationOid: organization.oid, id: { in: ids } },
          select: { id: true, name: true, slug: true, status: true, kind: true }
        }),
        row => ({ name: row.name, slug: row.slug, status: row.status, kind: row.kind })
      );
      break;
    case 'project':
      put(
        await db.project.findMany({
          where: { organizationOid: organization.oid, id: { in: ids } },
          select: { id: true, name: true, ref: true }
        }),
        row => ({ name: row.name, ref: row.ref })
      );
      break;
    case 'instance':
      put(
        await db.instance.findMany({
          where: { organizationOid: organization.oid, id: { in: ids } },
          select: { id: true, name: true, ref: true }
        }),
        row => ({ name: row.name, ref: row.ref })
      );
      break;
    case 'model':
      put(
        await db.knowledgeModel.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true, labId: true, familyId: true, status: true }
        }),
        row => ({
          name: row.name,
          labId: row.labId,
          familyId: row.familyId,
          status: row.status
        })
      );
      break;
    case 'family':
      put(
        await db.knowledgeFamily.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true, labId: true, status: true }
        }),
        row => ({ name: row.name, labId: row.labId, status: row.status })
      );
      break;
    case 'vendor':
      put(
        await db.knowledgeVendor.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true, kind: true }
        }),
        row => ({ name: row.name, kind: row.kind })
      );
      break;
    case 'agent':
      put(
        await db.knowledgeAgent.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true, makerId: true }
        }),
        row => ({ name: row.name, makerId: row.makerId })
      );
      break;
    case 'lab':
    case 'maker':
      put(
        await db.knowledgeOrganization.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true }
        }),
        row => ({ name: row.name })
      );
      break;
  }

  return result;
};

let idsOf = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.flatMap(idsOf);
  return typeof value == 'string' && value != '$other' ? [value] : [];
};

export let collectLabels = async (d: {
  organization: Organization;
  targets: LabelTarget[];
  rows: Record<string, unknown>[];
}) => {
  let wanted = new Map<LabelSource, Set<string>>();
  let columns = d.targets.filter(target => target.field.label);

  for (let target of columns) {
    let set = wanted.get(target.field.label!) ?? new Set<string>();
    for (let row of d.rows) {
      for (let id of idsOf(row[target.column])) if (set.size < maxLabelValues) set.add(id);
    }
    wanted.set(target.field.label!, set);
  }

  let fetched = new Map<LabelSource, Map<string, Label>>();
  await Promise.all(
    [...wanted].map(async ([source, ids]) => {
      fetched.set(source, await fetchLabels(d.organization, source, [...ids]));
    })
  );

  let labels: Record<string, Record<string, Label>> = {};
  for (let target of columns) {
    let source = fetched.get(target.field.label!);
    let entries: Record<string, Label> = {};
    for (let row of d.rows) {
      for (let id of idsOf(row[target.column])) {
        let label = source?.get(id);
        if (label) entries[id] = label;
      }
    }
    labels[target.column] = entries;
  }

  return labels;
};
