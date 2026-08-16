import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { getConfig } from '@metorial/config';
import { db, getId, withTransaction } from '@metorial-subspace/db';

export let reconcileSkillProviderLinksQueue = createQueue<{ skillId: string }>({
  name: 'sub/sk/lc/reconcileSkillProviderLinks',
  redisUrl: getConfig().redisUrl
});

export let reconcileSkillProviderLinks = async (d: { skillId: string }) => {
  let skill = await db.skill.findUnique({
    where: { id: d.skillId },
    include: {
      skillProviders: {
        where: { status: 'active' as const }
      },
      skillIntegrations: {
        where: { status: 'active' as const },
        include: {
          integration: {
            include: {
              providers: {
                where: { status: 'active' as const }
              }
            }
          }
        }
      },
      skillProviderLinks: true
    }
  });
  if (!skill) throw new QueueRetryError();

  let desiredProviderOids = new Set<bigint>(
    skill.skillProviders.map(provider => provider.providerOid)
  );

  for (let skillIntegration of skill.skillIntegrations) {
    for (let integrationProvider of skillIntegration.integration.providers) {
      desiredProviderOids.add(integrationProvider.providerOid);
    }
  }

  let existingProviderOids = new Set(skill.skillProviderLinks.map(link => link.providerOid));
  let providerOidsToCreate = Array.from(desiredProviderOids).filter(
    providerOid => !existingProviderOids.has(providerOid)
  );
  let linkOidsToDelete = skill.skillProviderLinks
    .filter(link => !desiredProviderOids.has(link.providerOid) || skill.status !== 'active')
    .map(link => link.oid);

  await withTransaction(async db => {
    if (linkOidsToDelete.length) {
      await db.skillProviderLink.deleteMany({
        where: {
          oid: { in: linkOidsToDelete }
        }
      });
    }

    for (let providerOid of skill.status === 'active' ? providerOidsToCreate : []) {
      await db.skillProviderLink.create({
        data: {
          ...getId('skillProviderLink'),
          skillOid: skill.oid,
          providerOid
        }
      });
    }
  });
};

export let reconcileSkillProviderLinksQueueProcessor =
  reconcileSkillProviderLinksQueue.process(async data => {
    await reconcileSkillProviderLinks(data);
  });

export let reconcileSkillProviderLinksForIntegrationProviderQueue = createQueue<{
  integrationProviderId: string;
}>({
  name: 'sub/sk/lc/reconcileSkillProviderLinksForIntegrationProvider',
  redisUrl: getConfig().redisUrl
});

export let reconcileSkillProviderLinksForIntegrationProviderQueueProcessor =
  reconcileSkillProviderLinksForIntegrationProviderQueue.process(async data => {
    let integrationProvider = await db.integrationProvider.findUnique({
      where: { id: data.integrationProviderId }
    });
    if (!integrationProvider) throw new QueueRetryError();

    let skills = await db.skill.findMany({
      where: {
        status: 'active' as const,
        skillIntegrations: {
          some: {
            status: 'active' as const,
            integrationOid: integrationProvider.integrationOid
          }
        }
      },
      select: { id: true }
    });
    if (!skills.length) return;

    await reconcileSkillProviderLinksQueue.addMany(
      skills.map(skill => ({ skillId: skill.id }))
    );
  });

export let reconcileSkillProviderLinksForProviderQueue = createQueue<{
  providerId: string;
}>({
  name: 'sub/sk/lc/reconcileSkillProviderLinksForProvider',
  redisUrl: getConfig().redisUrl
});

export let reconcileSkillProviderLinksForProviderQueueProcessor =
  reconcileSkillProviderLinksForProviderQueue.process(async data => {
    let provider = await db.provider.findUnique({
      where: { id: data.providerId }
    });
    if (!provider) throw new QueueRetryError();

    let skills = await db.skill.findMany({
      where: {
        status: 'active' as const,
        OR: [
          {
            skillProviders: {
              some: {
                status: 'active' as const,
                providerOid: provider.oid
              }
            }
          },
          {
            skillProviderLinks: {
              some: {
                providerOid: provider.oid
              }
            }
          },
          {
            skillIntegrations: {
              some: {
                status: 'active' as const,
                integration: {
                  providers: {
                    some: {
                      status: 'active' as const,
                      providerOid: provider.oid
                    }
                  }
                }
              }
            }
          }
        ]
      },
      select: { id: true }
    });
    if (!skills.length) return;

    await reconcileSkillProviderLinksQueue.addMany(
      skills.map(skill => ({ skillId: skill.id }))
    );
  });
