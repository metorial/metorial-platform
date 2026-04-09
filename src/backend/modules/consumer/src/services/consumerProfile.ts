import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  getEffectiveConsumerGroups,
  normalizeStringList,
  type EffectiveConsumerGroup
} from '@metorial/consumer-auth';
import {
  ConsumerGroup,
  ConsumerProfile,
  ConsumerSurface,
  db,
  ID,
  Instance,
  InstanceConsumer,
  OrganizationMember,
  Prisma,
  withTransaction
} from '@metorial/db';
import { createLock } from '@metorial/lock';
import { searchConsumerIds } from '@metorial/module-search';
import {
  enqueueConsumerProfileCreated,
  enqueueConsumerProfileUpdated
} from '../queues/lifecycle/consumerProfile';
import { consumerService } from './consumer';

let include = {
  consumer: true,
  surface: {
    include: {
      portal: true
    }
  },
  personalConsumerGroup: true,
  groups: {
    include: {
      group: true
    }
  }
} as const;

export let ensureProfileLock = createLock({
  name: 'cons/ensureProfile'
});

class ConsumerProfileServiceImpl {
  private async getAssignableGroupsOrThrow(d: {
    consumerProfile: Pick<ConsumerProfile, 'surfaceOid'>;
    groupIds: string[];
  }) {
    let groupIds = Array.from(new Set(d.groupIds));
    if (!groupIds.length) {
      return [];
    }

    let groups = await db.consumerGroup.findMany({
      where: {
        id: { in: groupIds },
        surfaceOid: d.consumerProfile.surfaceOid,
        status: 'active',
        type: 'default'
      }
    });

    if (groups.length !== groupIds.length) {
      throw new ServiceError(notFoundError('consumer.group'));
    }

    return groups;
  }

  async getConsumerProfileById(d: {
    consumerSurface: ConsumerSurface;
    consumerProfileId: string;
  }) {
    let consumerProfile = await db.consumerProfile.findFirst({
      where: {
        surfaceOid: d.consumerSurface.oid,
        id: d.consumerProfileId
      },
      include
    });
    if (!consumerProfile) {
      throw new ServiceError(notFoundError('consumer.profile'));
    }

    return consumerProfile;
  }

  async listConsumerProfiles(d: {
    consumerSurface: ConsumerSurface;
    search?: string;
    consumerGroupId?: string;
  }) {
    let search = d.search?.trim();
    let consumerGroupId = d.consumerGroupId?.trim();
    let instance = search
      ? await db.instance.findFirst({
          where: {
            oid: d.consumerSurface.instanceOid
          },
          select: {
            id: true
          }
        })
      : null;
    let searchedConsumerIds =
      search && instance
        ? await searchConsumerIds({
            instanceId: instance.id,
            query: search
          })
        : undefined;
    let searchedConsumerOids =
      search && searchedConsumerIds?.length
        ? (
            await db.instanceConsumer.findMany({
              where: {
                instanceOid: d.consumerSurface.instanceOid,
                id: { in: searchedConsumerIds }
              },
              select: { consumerOid: true },
              distinct: ['consumerOid']
            })
          ).map(consumer => consumer.consumerOid)
        : search
          ? []
          : undefined;

    let groupMembershipWhere: Prisma.ConsumerProfileWhereInput | undefined;

    if (consumerGroupId) {
      let group = await db.consumerGroup.findFirst({
        where: {
          id: consumerGroupId,
          surfaceOid: d.consumerSurface.oid,
          status: 'active'
        }
      });

      if (!group) {
        groupMembershipWhere = { id: { in: [] } };
      } else if (group.isDefault) {
        groupMembershipWhere = undefined;
      } else {
        let or: Prisma.ConsumerProfileWhereInput[] = [
          {
            groups: {
              some: {
                group: {
                  id: consumerGroupId,
                  surfaceOid: d.consumerSurface.oid
                }
              }
            }
          },
          { personalConsumerGroupOid: group.oid }
        ];

        if (group.ssoGroupIds.length) {
          or.push({
            ssoGroupIds: { hasSome: group.ssoGroupIds }
          });
        }

        groupMembershipWhere = { OR: or };
      }
    }

    let andParts: Prisma.ConsumerProfileWhereInput[] = [
      { surfaceOid: d.consumerSurface.oid },
      ...(groupMembershipWhere ? [groupMembershipWhere] : []),
      ...(search ? [{ consumerOid: { in: searchedConsumerOids ?? [] } }] : [])
    ];

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        return await db.consumerProfile.findMany({
          ...opts,
          where: {
            AND: andParts
          },
          include
        });
      })
    );
  }

  async getConsumerProfileByIdForConsumer(d: {
    consumer: Pick<InstanceConsumer, 'instanceOid' | 'consumerOid'>;
    consumerProfileId: string;
  }) {
    let consumerProfile = await db.consumerProfile.findFirst({
      where: {
        instanceOid: d.consumer.instanceOid,
        consumerOid: d.consumer.consumerOid,
        id: d.consumerProfileId
      },
      include
    });
    if (!consumerProfile) {
      throw new ServiceError(notFoundError('consumer.profile'));
    }

    return consumerProfile;
  }

  async listConsumerProfilesForConsumer(d: {
    consumer: Pick<InstanceConsumer, 'instanceOid' | 'consumerOid'>;
  }) {
    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        return await db.consumerProfile.findMany({
          ...opts,
          where: {
            instanceOid: d.consumer.instanceOid,
            consumerOid: d.consumer.consumerOid
          },
          include
        });
      })
    );
  }

  async getConsumerProfileByIdForInstance(d: {
    instance: Instance;
    consumerProfileId: string;
  }) {
    let consumerProfile = await db.consumerProfile.findFirst({
      where: {
        instanceOid: d.instance.oid,
        id: d.consumerProfileId
      },
      include
    });
    if (!consumerProfile) {
      throw new ServiceError(notFoundError('consumer.profile'));
    }

    return consumerProfile;
  }

  async findConsumerProfilesByIdForInstance(d: {
    instance: Instance;
    consumerProfileIds: string[];
  }) {
    if (!d.consumerProfileIds.length) {
      return [];
    }

    return await db.consumerProfile.findMany({
      where: {
        instanceOid: d.instance.oid,
        id: {
          in: d.consumerProfileIds
        }
      },
      include
    });
  }

  async ensureConsumerProfile(d: {
    surface: ConsumerSurface;
    email: string;
    name: string;
    member?: OrganizationMember;

    aresUserId?: string;
    ssoGroupIds?: string[];
    ssoRoles?: string[];
  }) {
    let res = await ensureProfileLock.usingLock(
      `${d.surface.instanceOid}-${d.email}`,
      async () => {
        let ssoGroupIds = normalizeStringList(d.ssoGroupIds);
        let ssoRoles = normalizeStringList(d.ssoRoles);
        let organization = await db.organization.findFirstOrThrow({
          where: {
            oid: d.surface.organizationOid
          }
        });
        let instance = await db.instance.findFirstOrThrow({
          where: {
            oid: d.surface.instanceOid
          }
        });
        let instanceConsumer = await consumerService.upsertConsumer({
          organization,
          instance,
          member: d.member,
          flags: {
            isOrganizationMember: d.surface.type === 'organization_members',
            isPortalConsumer: d.surface.type === 'portal'
          },
          input: {
            name: d.name,
            email: d.email
          }
        });

        if (d.member && !d.member.usesMetorialPersonal && d.surface.isInternal) {
          await db.organizationMember.updateMany({
            where: { oid: d.member.oid },
            data: { usesMetorialPersonal: true }
          });
        }

        return await withTransaction(async db => {
          let existingProfile = await db.consumerProfile.findUnique({
            where: d.aresUserId
              ? {
                  surfaceOid_aresUserId: {
                    surfaceOid: d.surface.oid,
                    aresUserId: d.aresUserId
                  }
                }
              : { email_surfaceOid: { email: d.email, surfaceOid: d.surface.oid } }
          });
          if (existingProfile) {
            return {
              lifecycleAction: 'updated' as const,
              instanceConsumer,
              consumerProfile: await db.consumerProfile.update({
                where: {
                  oid: existingProfile.oid
                },
                data: {
                  aresUserId: d.aresUserId,
                  email: d.email,
                  name: d.name,
                  consumerOid: instanceConsumer.consumerOid,
                  organizationMemberOid:
                    d.member?.oid ?? instanceConsumer.organizationMemberOid,
                  organizationActorOid:
                    d.member?.actorOid ?? instanceConsumer.organizationActorOid,
                  ssoGroupIds,
                  ssoRoles
                },
                include
              })
            };
          }

          let accessTag = await db.accessTag.create({
            data: {
              instanceOid: d.surface.instanceOid
            }
          });

          let personalConsumerGroup = await db.consumerGroup.create({
            data: {
              id: await ID.generateId('consumerGroup'),
              status: 'active',
              type: 'user_access',
              isDefault: false,
              ssoGroupIds: [],
              name: `Personal Group for ${d.email}`,
              description: null,
              surfaceOid: d.surface.oid,
              accessTagOid: accessTag.oid
            }
          });

          return {
            lifecycleAction: 'created' as const,
            instanceConsumer,
            consumerProfile: await db.consumerProfile.create({
              data: {
                id: await ID.generateId('consumerProfile'),
                aresUserId: d.aresUserId,
                email: d.email,
                name: d.name,
                ssoGroupIds,
                ssoRoles,
                organizationOid: d.surface.organizationOid,
                instanceOid: d.surface.instanceOid,
                surfaceOid: d.surface.oid,
                consumerOid: instanceConsumer.consumerOid,
                organizationMemberOid: d.member?.oid ?? instanceConsumer.organizationMemberOid,
                organizationActorOid:
                  d.member?.actorOid ?? instanceConsumer.organizationActorOid,
                accessTagOid: accessTag.oid,
                personalConsumerGroupOid: personalConsumerGroup.oid
              },
              include
            })
          };
        });
      }
    );

    if (res.lifecycleAction === 'created') {
      await enqueueConsumerProfileCreated(res.consumerProfile.id);
    } else {
      await enqueueConsumerProfileUpdated(res.consumerProfile.id);
    }

    return res.consumerProfile;
  }

  async getStoredGroupsForProfiles(d: {
    consumerSurface: ConsumerSurface;
    consumerProfiles: Array<
      ConsumerProfile & {
        personalConsumerGroup: ConsumerGroup;
        groups: Array<{ group: ConsumerGroup }>;
      }
    >;
  }) {
    if (!d.consumerProfiles.length) {
      return {} as Record<string, EffectiveConsumerGroup[]>;
    }

    let activeGroups = await db.consumerGroup.findMany({
      where: {
        surfaceOid: d.consumerSurface.oid,
        status: 'active'
      }
    });

    let toAssignedGroup = (
      group: ConsumerGroup,
      assignedVia: EffectiveConsumerGroup['assignedVia']
    ): EffectiveConsumerGroup => ({
      ...group,
      assignedVia
    });
    let groupsByProfile: Record<string, EffectiveConsumerGroup[]> = {};

    for (let consumerProfile of d.consumerProfiles) {
      let manualGroupIds = new Set(consumerProfile.groups.map(({ group }) => group.oid));
      let ssoGroupIds = new Set(consumerProfile.ssoGroupIds ?? []);

      groupsByProfile[consumerProfile.id] = activeGroups.flatMap(group => {
        if (group.oid == consumerProfile.personalConsumerGroupOid) {
          return [toAssignedGroup(group, 'user')];
        }

        if (group.isDefault) {
          return [toAssignedGroup(group, 'default')];
        }

        if (group.ssoGroupIds.some(ssoGroupId => ssoGroupIds.has(ssoGroupId))) {
          return [toAssignedGroup(group, 'sso')];
        }

        if (manualGroupIds.has(group.oid)) {
          return [toAssignedGroup(group, 'manual')];
        }

        return [];
      });
    }

    return groupsByProfile;
  }

  async assignToGroups<T extends ConsumerProfile>(d: {
    consumerProfile: T;
    groupIds: string[];
  }) {
    let groups = await this.getAssignableGroupsOrThrow(d);

    if (groups.length) {
      await db.consumerProfileGroup.createMany({
        data: groups.map(group => ({
          profileOid: d.consumerProfile.oid,
          groupOid: group.oid
        })),
        skipDuplicates: true
      });
    }

    return d.consumerProfile;
  }

  async removeFromGroups<T extends ConsumerProfile>(d: {
    consumerProfile: T;
    groupIds: string[];
  }) {
    let groups = await this.getAssignableGroupsOrThrow(d);

    await db.consumerProfileGroup.deleteMany({
      where: {
        profileOid: d.consumerProfile.oid,
        groupOid: { in: groups.map(group => group.oid) }
      }
    });

    return d.consumerProfile;
  }

  async getGroupsForProfile(d: { consumerProfile: ConsumerProfile; ssoGroupIds?: string[] }) {
    return await getEffectiveConsumerGroups({
      consumerProfile: d.consumerProfile,
      ssoGroupIds: d.ssoGroupIds ?? d.consumerProfile.ssoGroupIds ?? []
    });
  }
}

export let consumerProfileService = Service.create(
  'consumerProfileService',
  () => new ConsumerProfileServiceImpl()
).build();
