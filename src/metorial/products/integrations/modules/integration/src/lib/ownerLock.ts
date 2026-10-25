import {
  db,
  type IntegrationInstance,
  type IntegrationInstanceGroup
} from '@metorial-subspace/db';

type OwnerFlag = 'isOwnerLocked' | 'isOwnerOnlyVisible';

let setIntegrationInstanceOwnerFlag = async (
  integrationInstance: Pick<IntegrationInstance, 'oid'>,
  flag: OwnerFlag,
  value: boolean
) => {
  await db.integrationInstance.update({
    where: { oid: integrationInstance.oid },
    data: { [flag]: value }
  });

  await db.magicMcpServerBacking.updateMany({
    where: { integrationInstanceOid: integrationInstance.oid, [flag]: !value },
    data: { [flag]: value }
  });

  let sessionTemplates = await db.sessionTemplate.findMany({
    where: { integrationInstanceOid: integrationInstance.oid },
    select: { oid: true }
  });
  if (!sessionTemplates.length) return;

  let sessionTemplateOids = sessionTemplates.map(sessionTemplate => sessionTemplate.oid);

  await db.sessionTemplate.updateMany({
    where: { oid: { in: sessionTemplateOids }, [flag]: !value },
    data: { [flag]: value }
  });

  await db.ephemeralManagedSession.updateMany({
    where: { sessionTemplateOid: { in: sessionTemplateOids }, [flag]: !value },
    data: { [flag]: value }
  });
};

export let setIntegrationInstanceOwnerLock = (
  integrationInstance: Pick<IntegrationInstance, 'oid'>,
  isOwnerLocked: boolean
) => setIntegrationInstanceOwnerFlag(integrationInstance, 'isOwnerLocked', isOwnerLocked);

export let setIntegrationInstanceOwnerOnlyVisibility = (
  integrationInstance: Pick<IntegrationInstance, 'oid'>,
  isOwnerOnlyVisible: boolean
) =>
  setIntegrationInstanceOwnerFlag(
    integrationInstance,
    'isOwnerOnlyVisible',
    isOwnerOnlyVisible
  );

export let lockIntegrationInstanceOwner = (
  integrationInstance: Pick<IntegrationInstance, 'oid'>
) => setIntegrationInstanceOwnerLock(integrationInstance, true);

export let setIntegrationInstanceGroupOwnerOnlyVisibility = async (
  integrationInstanceGroup: Pick<IntegrationInstanceGroup, 'oid'>,
  isOwnerOnlyVisible: boolean
) => {
  await db.integrationInstanceGroup.update({
    where: { oid: integrationInstanceGroup.oid },
    data: { isOwnerOnlyVisible }
  });

  let sessionTemplates = await db.sessionTemplate.findMany({
    where: { integrationInstanceGroupOid: integrationInstanceGroup.oid },
    select: { oid: true }
  });
  if (!sessionTemplates.length) return;

  let sessionTemplateOids = sessionTemplates.map(sessionTemplate => sessionTemplate.oid);

  await db.sessionTemplate.updateMany({
    where: { oid: { in: sessionTemplateOids }, isOwnerOnlyVisible: !isOwnerOnlyVisible },
    data: { isOwnerOnlyVisible }
  });

  await db.ephemeralManagedSession.updateMany({
    where: {
      sessionTemplateOid: { in: sessionTemplateOids },
      isOwnerOnlyVisible: !isOwnerOnlyVisible
    },
    data: { isOwnerOnlyVisible }
  });
};
