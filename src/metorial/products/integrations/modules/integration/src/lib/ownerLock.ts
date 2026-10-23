import { db, type IntegrationInstance } from '@metorial-subspace/db';

export let setIntegrationInstanceOwnerLock = async (
  integrationInstance: Pick<IntegrationInstance, 'oid'>,
  isOwnerLocked: boolean
) => {
  await db.integrationInstance.update({
    where: { oid: integrationInstance.oid },
    data: { isOwnerLocked }
  });

  await db.magicMcpServerBacking.updateMany({
    where: { integrationInstanceOid: integrationInstance.oid, isOwnerLocked: !isOwnerLocked },
    data: { isOwnerLocked }
  });

  let sessionTemplates = await db.sessionTemplate.findMany({
    where: { integrationInstanceOid: integrationInstance.oid },
    select: { oid: true }
  });
  if (!sessionTemplates.length) return;

  let sessionTemplateOids = sessionTemplates.map(sessionTemplate => sessionTemplate.oid);

  await db.sessionTemplate.updateMany({
    where: { oid: { in: sessionTemplateOids }, isOwnerLocked: !isOwnerLocked },
    data: { isOwnerLocked }
  });

  await db.ephemeralManagedSession.updateMany({
    where: { sessionTemplateOid: { in: sessionTemplateOids }, isOwnerLocked: !isOwnerLocked },
    data: { isOwnerLocked }
  });
};

export let lockIntegrationInstanceOwner = (
  integrationInstance: Pick<IntegrationInstance, 'oid'>
) => setIntegrationInstanceOwnerLock(integrationInstance, true);
