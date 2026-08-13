import { Service } from '@lowerdeck/service';
import { db as subspaceDb } from '@metorial-subspace/db';
import { getMirrorReferencePlan, type MirrorReference } from '../lib/mirrorReferences';

let backfillReferences = async (d: {
  references: MirrorReference[];
  legacyOid: bigint;
  mirrorOid: bigint;
}) => {
  let updated = 0;

  for (let reference of d.references) {
    updated += (
      await (subspaceDb as any)[reference.delegate].updateMany({
        where: {
          [reference.legacyField]: d.legacyOid,
          [reference.mirrorField]: null
        },
        data: {
          [reference.mirrorField]: d.mirrorOid
        }
      })
    ).count;
  }

  return updated;
};

class BackfillMirrorReferencesServiceImpl {
  async backfillTenantReferences(d: { tenantOid: bigint }) {
    let tenant = await subspaceDb.tenant.findUnique({
      where: {
        oid: d.tenantOid
      },
      select: {
        oid: true,
        projectOid: true
      }
    });

    if (!tenant?.projectOid) return { updated: 0 };

    return {
      updated: await backfillReferences({
        references: getMirrorReferencePlan().fromTenant,
        legacyOid: tenant.oid,
        mirrorOid: tenant.projectOid
      })
    };
  }

  async backfillEnvironmentReferences(d: { environmentOid: bigint }) {
    let environment = await subspaceDb.environment.findUnique({
      where: {
        oid: d.environmentOid
      },
      select: {
        oid: true,
        instanceOid: true
      }
    });

    if (!environment?.instanceOid) return { updated: 0 };

    return {
      updated: await backfillReferences({
        references: getMirrorReferencePlan().fromEnvironment,
        legacyOid: environment.oid,
        mirrorOid: environment.instanceOid
      })
    };
  }
}

export let backfillMirrorReferencesService = Service.create(
  'backfillMirrorReferencesService',
  () => new BackfillMirrorReferencesServiceImpl()
).build();
