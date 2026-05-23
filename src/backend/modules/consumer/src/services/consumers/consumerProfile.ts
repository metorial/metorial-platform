import { conflictError, notFoundError, ServiceError } from '@mtsrc/error';
import { Paginator } from '@mtsrc/pagination';
import { Service } from '@mtsrc/service';
import {
  getEffectiveConsumerGroups,
  normalizeStringList,
  type EffectiveConsumerGroup
} from '@metorial/consumer-auth';
import {
  ConsumerGroup,
  ConsumerProfile,
  ConsumerProfileInviteStatus,
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
import { consumerInviteUpdatedQueue } from '../../queues/lifecycle/consumerInvite';
import {
  consumerProfileCreatedQueue,
  consumerProfileUpdatedQueue
} from '../../queues/lifecycle/consumerProfile';
import { consumerService } from './consumer';
import type { EnrichedConsumerSurface } from './consumerSurface';
import { consumerSurfaceInclude, consumerSurfaceService } from './consumerSurface';

let include = {
  consumer: true,
  surface: {
    include: {
      ...consumerSurfaceInclude,
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

type ConsumerProfileWithRelations = Prisma.ConsumerProfileGetPayload<{
  include: typeof include;
}>;

type EnrichedConsumerProfile<T extends ConsumerProfileWithRelations> = T & {
  instanceConsumer: InstanceConsumer | null;
  surface: T['surface'] & Pick<EnrichedConsumerSurface, 'skillConfiguration'>;
};

let getInstanceConsumerKey = (d: { instanceOid: bigint; consumerOid: bigint }) =>
  `${d.instanceOid.toString()}:${d.consumerOid.toString()}`;

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

  async enrichConsumerProfile<T extends ConsumerProfileWithRelations>(d: {
    consumerProfile: T;
    instanceConsumer?: InstanceConsumer | null;
  }) {
    let [consumerProfile] = await this.enrichConsumerProfiles({
      consumerProfiles: [d.consumerProfile],
      instanceConsumers: d.instanceConsumer ? [d.instanceConsumer] : undefined
    });

    return consumerProfile!;
  }

  async enrichConsumerProfiles<T extends ConsumerProfileWithRelations>(d: {
    consumerProfiles: T[];
    instanceConsumers?: InstanceConsumer[];
  }) {
    if (!d.consumerProfiles.length) {
      return [] as EnrichedConsumerProfile<T>[];
    }

    let instanceConsumers = d.instanceConsumers ?? [];
    let instanceConsumerMap = new Map(
      instanceConsumers.map(instanceConsumer => [
        getInstanceConsumerKey(instanceConsumer),
        instanceConsumer
      ])
    );
    let missingInstanceConsumerPairs = Array.from(
      new Map(
        d.consumerProfiles
          .filter(
            consumerProfile =>
              !instanceConsumerMap.has(getInstanceConsumerKey(consumerProfile))
          )
          .map(consumerProfile => [
            getInstanceConsumerKey(consumerProfile),
            {
              instanceOid: consumerProfile.instanceOid,
              consumerOid: consumerProfile.consumerOid
            }
          ])
      ).values()
    );

    if (missingInstanceConsumerPairs.length) {
      let foundInstanceConsumers = await db.instanceConsumer.findMany({
        where: {
          OR: missingInstanceConsumerPairs
        }
      });

      for (let instanceConsumer of foundInstanceConsumers) {
        instanceConsumerMap.set(getInstanceConsumerKey(instanceConsumer), instanceConsumer);
      }
    }

    let instanceOids = Array.from(
      new Set(d.consumerProfiles.map(consumerProfile => consumerProfile.instanceOid))
    );
    let instances = await db.instance.findMany({
      where: {
        oid: { in: instanceOids }
      }
    });
    let enrichedSurfaceByOid = new Map<
      bigint,
      T['surface'] & Pick<EnrichedConsumerSurface, 'skillConfiguration'>
    >();

    for (let instance of instances) {
      let surfaces = d.consumerProfiles
        .filter(consumerProfile => consumerProfile.instanceOid === instance.oid)
        .map(consumerProfile => consumerProfile.surface);

      let enrichedSurfaces = await consumerSurfaceService.enrichConsumerSurfaces({
        instance,
        consumerSurfaces: surfaces
      });

      for (let surface of enrichedSurfaces) {
        enrichedSurfaceByOid.set(surface.oid, surface);
      }
    }

    return d.consumerProfiles.map(consumerProfile => ({
      ...consumerProfile,
      surface: enrichedSurfaceByOid.get(consumerProfile.surface.oid)!,
      instanceConsumer:
        instanceConsumerMap.get(getInstanceConsumerKey(consumerProfile)) ?? null
    })) as EnrichedConsumerProfile<T>[];
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

    return await this.enrichConsumerProfile({ consumerProfile });
  }

  async listConsumerProfiles(d: {
    consumerSurface: ConsumerSurface;
    search?: string;
    consumerGroupId?: string;
    statuses?: Array<'active' | 'invited'>;
  }) {
    let search = d.search?.trim();
    let consumerGroupId = d.consumerGroupId?.trim();
    let statuses = d.statuses?.length ? new Set(d.statuses) : null;
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
    let inviteStatusWhere: Prisma.ConsumerProfileWhereInput | undefined;

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

    if (statuses && !(statuses.has('active') && statuses.has('invited'))) {
      inviteStatusWhere = statuses.has('active')
        ? { inviteStatus: { in: ['unset', 'accepted'] } }
        : { inviteStatus: 'invited' };
    }

    let andParts: Prisma.ConsumerProfileWhereInput[] = [
      { surfaceOid: d.consumerSurface.oid },
      ...(groupMembershipWhere ? [groupMembershipWhere] : []),
      ...(inviteStatusWhere ? [inviteStatusWhere] : []),
      ...(search ? [{ consumerOid: { in: searchedConsumerOids ?? [] } }] : [])
    ];

    let paginator = Paginator.create(({ prisma }) =>
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

    return {
      run: async (...args: Parameters<typeof paginator.run>) => {
        let list = await paginator.run(...args);

        return {
          ...list,
          items: await this.enrichConsumerProfiles({
            consumerProfiles: list.items
          })
        };
      }
    };
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

    return await this.enrichConsumerProfile({ consumerProfile });
  }

  async listConsumerProfilesForConsumer(d: {
    consumer: Pick<InstanceConsumer, 'instanceOid' | 'consumerOid'>;
  }) {
    let paginator = Paginator.create(({ prisma }) =>
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

    return {
      run: async (...args: Parameters<typeof paginator.run>) => {
        let list = await paginator.run(...args);

        return {
          ...list,
          items: await this.enrichConsumerProfiles({
            consumerProfiles: list.items
          })
        };
      }
    };
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

    return await this.enrichConsumerProfile({ consumerProfile });
  }

  async findConsumerProfilesByIdForInstance(d: {
    instance: Instance;
    consumerProfileIds: string[];
  }) {
    if (!d.consumerProfileIds.length) {
      return [];
    }

    return await this.enrichConsumerProfiles({
      consumerProfiles: await db.consumerProfile.findMany({
        where: {
          instanceOid: d.instance.oid,
          id: {
            in: d.consumerProfileIds
          }
        },
        include
      })
    });
  }

  async ensureConsumerProfile(d: {
    surface: ConsumerSurface;
    email: string;
    name: string;
    member?: OrganizationMember;
    inviteStatus?: ConsumerProfileInviteStatus;
    rejectIfActiveProfileExists?: boolean;

    aresUserId?: string;
    ssoGroupIds?: string[];
    ssoRoles?: string[];
  }) {
    let updatedInviteIds: string[] = [];
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
          let existingProfile = await db.consumerProfile.findFirst({
            where: {
              OR: [
                ...(d.aresUserId
                  ? [
                      {
                        surfaceOid: d.surface.oid,
                        aresUserId: d.aresUserId
                      }
                    ]
                  : []),
                {
                  email: d.email,
                  surfaceOid: d.surface.oid
                }
              ]
            }
          });
          if (existingProfile) {
            if (d.rejectIfActiveProfileExists && existingProfile.inviteStatus != 'invited') {
              throw new ServiceError(
                conflictError({
                  message: 'Consumer already has an active profile for this portal.'
                })
              );
            }

            let nextInviteStatus =
              d.aresUserId && existingProfile.inviteStatus == 'invited'
                ? ('accepted' as const)
                : (d.inviteStatus ?? existingProfile.inviteStatus);
            let consumerProfile = await db.consumerProfile.update({
              where: {
                oid: existingProfile.oid
              },
              data: {
                aresUserId: d.aresUserId,
                email: d.email,
                name: d.name,
                inviteStatus: nextInviteStatus,
                consumerOid: instanceConsumer.consumerOid,
                organizationMemberOid: d.member?.oid ?? instanceConsumer.organizationMemberOid,
                organizationActorOid:
                  d.member?.actorOid ?? instanceConsumer.organizationActorOid,
                ssoGroupIds,
                ssoRoles
              },
              include
            });
            if (nextInviteStatus == 'accepted' && existingProfile.inviteStatus != 'accepted') {
              let pendingInvites = await db.consumerInvite.findMany({
                where: {
                  consumerProfileOid: existingProfile.oid,
                  status: 'pending'
                },
                select: {
                  id: true
                }
              });
              updatedInviteIds.push(...pendingInvites.map(invite => invite.id));

              await db.consumerInvite.updateMany({
                where: {
                  consumerProfileOid: existingProfile.oid,
                  status: 'pending'
                },
                data: {
                  status: 'accepted',
                  acceptedAt: new Date()
                }
              });
            }

            return {
              lifecycleAction: 'updated' as const,
              instanceConsumer,
              consumerProfile
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
                inviteStatus: d.inviteStatus ?? 'unset',
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
      await consumerProfileCreatedQueue.add({ consumerProfileId: res.consumerProfile.id });
    } else {
      await consumerProfileUpdatedQueue.add({ consumerProfileId: res.consumerProfile.id });
    }

    if (updatedInviteIds.length > 0) {
      await consumerInviteUpdatedQueue.addMany(
        updatedInviteIds.map(consumerInviteId => ({ consumerInviteId }))
      );
    }

    return await this.enrichConsumerProfile({
      consumerProfile: res.consumerProfile,
      instanceConsumer: res.instanceConsumer
    });
  }

  async getStoredGroupsForProfiles(d: {
    consumerSurface: ConsumerSurface;
    consumerProfiles: Array<
      ConsumerProfileWithRelations & {
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

  async assignToGroups<T extends ConsumerProfileWithRelations>(d: {
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

    return await this.enrichConsumerProfile({
      consumerProfile: d.consumerProfile
    });
  }

  async removeFromGroups<T extends ConsumerProfileWithRelations>(d: {
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

    return await this.enrichConsumerProfile({
      consumerProfile: d.consumerProfile
    });
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
