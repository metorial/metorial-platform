import { db } from '../db';
import { getId } from '../id';
import type { Organization } from '../../prisma/generated/client';

export let ensureEntityStub = async (d: {
  organization: Pick<Organization, 'oid'>;
  kind: string;
  source: string;
  ref: string;
}) => {
  let where = {
    organizationOid_kind_source_ref: {
      organizationOid: d.organization.oid,
      kind: d.kind,
      source: d.source,
      ref: d.ref
    }
  };

  let existing = await db.entity.findUnique({ where });
  if (existing) return existing;

  try {
    return await db.entity.create({
      data: {
        ...getId('entity'),
        organizationOid: d.organization.oid,
        kind: d.kind,
        source: d.source,
        ref: d.ref,
        status: 'managed'
      }
    });
  } catch (error: any) {
    if (error?.code != 'P2002') throw error;

    return await db.entity.findUniqueOrThrow({ where });
  }
};
