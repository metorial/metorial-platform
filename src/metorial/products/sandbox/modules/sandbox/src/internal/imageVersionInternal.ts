import { Service } from '@lowerdeck/service';
import { withTransaction } from '@metorial/db';

class SandboxImageVersionInternalServiceImpl {
  async assignNumbers(d: { imageOid: bigint }) {
    await withTransaction(async db => {
      let unnumbered = await db.sandboxMachineImageVersion.count({
        where: { imageOid: d.imageOid, versionNumber: null }
      });
      if (!unnumbered) return;

      // Locks the image row so concurrent numbering of the same image waits for this one.
      await db.sandboxMachineImage.update({
        where: { oid: d.imageOid },
        data: { updatedAt: new Date() }
      });

      let latest = await db.sandboxMachineImageVersion.findFirst({
        where: { imageOid: d.imageOid, versionNumber: { not: null } },
        orderBy: { versionNumber: 'desc' },
        select: { versionNumber: true }
      });
      let pending = await db.sandboxMachineImageVersion.findMany({
        where: { imageOid: d.imageOid, versionNumber: null },
        orderBy: { oid: 'asc' },
        select: { oid: true }
      });

      let next = latest?.versionNumber ?? 0;
      for (let version of pending) {
        next += 1;

        await db.sandboxMachineImageVersion.update({
          where: { oid: version.oid },
          data: { versionNumber: next }
        });
      }
    });
  }
}

export let sandboxImageVersionInternalService = Service.create(
  'sandboxImageVersionInternalService',
  () => new SandboxImageVersionInternalServiceImpl()
).build();
