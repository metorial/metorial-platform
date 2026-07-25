import { conflictError, notFoundError, ServiceError } from '@lowerdeck/error';
import { generatePlainId } from '@lowerdeck/id';
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
import { Fabric } from '@metorial/fabric';
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
  resourceActors: true,
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

let normalizeEmailFilter = (emails?: string[]) => {
  let normalizedEmails = (emails ?? [])
    .map(email => email.trim().toLowerCase())
    .filter(Boolean);

  if (!normalizedEmails.length) return undefined;

  return Array.from(new Set(normalizedEmails));
};

export let ensureProfileLock = createLock({
  name: 'cons/ensureProfile'
});

class ConsumerProfileServiceImpl {
  private ensureConsumerProfileActive(consumerProfile: Pick<ConsumerProfile, 'status'>) {
    if (consumerProfile.status != 'active') {
      throw new ServiceError(
        conflictError({
          message: 'Consumer profile is already deleted.'
        })
      );
    }
  }

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

  private getSharedGroupVisibilityWhere(consumerGroups: ConsumerGroup[]) {
    let shareableGroups = consumerGroups.filter(group => group.type !== 'user_access');
    if (shareableGroups.some(group => group.isDefault)) {
      return undefined;
    }

    let groupOids = shareableGroups.map(group => group.oid);
    let ssoGroupIds = Array.from(
      new Set(shareableGroups.flatMap(group => group.ssoGroupIds ?? []))
    );
    let or: Prisma.ConsumerProfileWhereInput[] = [];

    if (groupOids.length) {
      or.push({
        groups: {
          some: {
            groupOid: {
              in: groupOids
            }
          }
        }
      });
    }

    if (ssoGroupIds.length) {
      or.push({
        ssoGroupIds: {
          hasSome: ssoGroupIds
        }
      });
    }

    if (!or.length) {
      return { id: { in: [] } } satisfies Prisma.ConsumerProfileWhereInput;
    }

    return { OR: or } satisfies Prisma.ConsumerProfileWhereInput;
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
        id: d.consumerProfileId,
        status: 'active'
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
    emails?: string[];
    consumerGroupId?: string;
    statuses?: Array<'active' | 'invited'>;
    visibleToConsumerGroups?: ConsumerGroup[];
  }) {
    let search = d.search?.trim();
    let emails = normalizeEmailFilter(d.emails);
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
    let visibilityWhere = d.visibleToConsumerGroups
      ? this.getSharedGroupVisibilityWhere(d.visibleToConsumerGroups)
      : undefined;

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
      { status: 'active' },
      ...(groupMembershipWhere ? [groupMembershipWhere] : []),
      ...(visibilityWhere ? [visibilityWhere] : []),
      ...(inviteStatusWhere ? [inviteStatusWhere] : []),
      ...(emails?.length ? [{ email: { in: emails } }] : []),
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

  async listConsumerProfilesVisibleToConsumer(d: {
    consumerSurface: ConsumerSurface;
    consumerProfile: ConsumerProfile;
    consumerGroups: ConsumerGroup[];
    search?: string;
    emails?: string[];
    consumerGroupId?: string;
    statuses?: Array<'active' | 'invited'>;
  }) {
    return await this.listConsumerProfiles({
      consumerSurface: d.consumerSurface,
      search: d.search,
      emails: d.emails,
      consumerGroupId: d.consumerGroupId,
      statuses: d.statuses,
      visibleToConsumerGroups: d.consumerGroups
    });
  }

  async getConsumerProfileVisibleToConsumer(d: {
    consumerSurface: ConsumerSurface;
    consumerProfile: ConsumerProfile;
    consumerGroups: ConsumerGroup[];
    consumerProfileId: string;
  }) {
    let visibilityWhere = this.getSharedGroupVisibilityWhere(d.consumerGroups);
    let consumerProfile = await db.consumerProfile.findFirst({
      where: {
        AND: [
          {
            surfaceOid: d.consumerSurface.oid,
            id: d.consumerProfileId,
            status: 'active'
          },
          ...(visibilityWhere ? [visibilityWhere] : [])
        ]
      },
      include
    });
    if (!consumerProfile) {
      throw new ServiceError(notFoundError('consumer.profile'));
    }

    return await this.enrichConsumerProfile({ consumerProfile });
  }

  async getConsumerProfileByIdForConsumer(d: {
    consumer: Pick<InstanceConsumer, 'instanceOid' | 'consumerOid'>;
    consumerProfileId: string;
  }) {
    let consumerProfile = await db.consumerProfile.findFirst({
      where: {
        instanceOid: d.consumer.instanceOid,
        consumerOid: d.consumer.consumerOid,
        id: d.consumerProfileId,
        status: 'active'
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
            consumerOid: d.consumer.consumerOid,
            status: 'active'
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
        id: d.consumerProfileId,
        status: 'active'
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
          status: 'active',
          id: {
            in: d.consumerProfileIds
          }
        },
        include
      })
    });
  }

  async createConsumerProfile(d: { surface: ConsumerSurface; email: string; name: string }) {
    return await this.ensureConsumerProfile({
      surface: d.surface,
      email: d.email,
      name: d.name,
      rejectIfActiveProfileExists: true
    });
  }

  async deleteConsumerProfile(d: { consumerProfile: ConsumerProfileWithRelations }) {
    this.ensureConsumerProfileActive(d.consumerProfile);

    let consumerProfile = await withTransaction(async db => {
      await Fabric.fire('consumer.profile.deleted:before', {
        consumerProfile: d.consumerProfile,
        surface: d.consumerProfile.surface
      });

      let consumerProfile = await db.consumerProfile.update({
        where: {
          oid: d.consumerProfile.oid
        },
        data: {
          status: 'deleted',
          deletedAt: new Date(),
          name: '[deleted]',
          email: `${generatePlainId()}@deleted.metorial.com`
        },
        include
      });

      await Fabric.fire('consumer.profile.deleted:after', {
        consumerProfile,
        surface: consumerProfile.surface
      });

      return consumerProfile;
    });

    await consumerProfileUpdatedQueue.add({
      consumerProfileId: consumerProfile.id
    });

    return await this.enrichConsumerProfile({ consumerProfile });
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
            },
            include: { surface: { include: { portal: true } } }
          });
          if (existingProfile) {
            if (
              d.rejectIfActiveProfileExists &&
              existingProfile.status == 'active' &&
              existingProfile.inviteStatus != 'invited'
            ) {
              throw new ServiceError(
                conflictError({
                  message: 'Consumer already has an active profile for this portal.'
                })
              );
            }

            await Fabric.fire('consumer.profile.updated:before', {
              consumerProfile: existingProfile,
              surface: existingProfile.surface
            });

            let nextInviteStatus =
              d.aresUserId && existingProfile.inviteStatus == 'invited'
                ? ('accepted' as const)
                : (d.inviteStatus ?? existingProfile.inviteStatus);
            let consumerProfile = await db.consumerProfile.update({
              where: {
                oid: existingProfile.oid
              },
              data: {
                status: 'active',
                aresUserId: d.aresUserId,
                email: d.email,
                name: d.name,
                inviteStatus: nextInviteStatus,
                consumerOid: instanceConsumer.consumerOid,
                organizationMemberOid: d.member?.oid ?? instanceConsumer.organizationMemberOid,
                organizationActorOid:
                  d.member?.actorOid ?? instanceConsumer.organizationActorOid,
                deletedAt: null,
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

          await Fabric.fire('consumer.profile.created:before', {
            surface: d.surface
          });

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
                status: 'active',
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
      await Fabric.fire('consumer.profile.created:after', {
        consumerProfile: res.consumerProfile,
        surface: res.consumerProfile.surface
      });

      await consumerProfileCreatedQueue.add({ consumerProfileId: res.consumerProfile.id });
    } else {
      await Fabric.fire('consumer.profile.updated:after', {
        consumerProfile: res.consumerProfile,
        surface: res.consumerProfile.surface
      });

      await consumerProfileUpdatedQueue.add({ consumerProfileId: res.consumerProfile.id });
    }

    if (updatedInviteIds.length > 0) {
      let updatedInvites = await db.consumerInvite.findMany({
        where: {
          id: {
            in: updatedInviteIds
          }
        },
        include: {
          consumerProfile: true,
          invitedBy: true,
          surface: {
            include: {
              portal: true
            }
          }
        }
      });

      for (let updatedInvite of updatedInvites) {
        await Fabric.fire('consumer.invite.updated:after', {
          consumerInvite: updatedInvite,
          consumerProfile: updatedInvite.consumerProfile,
          consumerSurface: updatedInvite.surface,
          performedBy: updatedInvite.invitedBy
        });
      }

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
      await withTransaction(async db => {
        let existingMemberships = await db.consumerProfileGroup.findMany({
          where: {
            profileOid: d.consumerProfile.oid,
            groupOid: {
              in: groups.map(group => group.oid)
            }
          }
        });
        let existingGroupOids = new Set(
          existingMemberships.map(membership => membership.groupOid)
        );
        let groupsToAdd = groups.filter(group => !existingGroupOids.has(group.oid));

        for (let group of groupsToAdd) {
          await Fabric.fire('consumer.profile.group.added:before', {
            consumerProfile: d.consumerProfile,
            consumerGroup: group
          });

          let consumerProfileGroup = await db.consumerProfileGroup.create({
            data: {
              profileOid: d.consumerProfile.oid,
              groupOid: group.oid
            }
          });

          await Fabric.fire('consumer.profile.group.added:after', {
            consumerProfile: d.consumerProfile,
            consumerGroup: group,
            consumerProfileGroup
          });
        }
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

    await withTransaction(async db => {
      let existingMemberships = await db.consumerProfileGroup.findMany({
        where: {
          profileOid: d.consumerProfile.oid,
          groupOid: { in: groups.map(group => group.oid) }
        }
      });
      let existingMembershipByGroupOid = new Map(
        existingMemberships.map(membership => [membership.groupOid, membership])
      );

      for (let group of groups) {
        let consumerProfileGroup = existingMembershipByGroupOid.get(group.oid);
        if (!consumerProfileGroup) continue;

        await Fabric.fire('consumer.profile.group.removed:before', {
          consumerProfile: d.consumerProfile,
          consumerGroup: group,
          consumerProfileGroup
        });

        await db.consumerProfileGroup.delete({
          where: {
            profileOid_groupOid: {
              profileOid: d.consumerProfile.oid,
              groupOid: group.oid
            }
          }
        });

        await Fabric.fire('consumer.profile.group.removed:after', {
          consumerProfile: d.consumerProfile,
          consumerGroup: group,
          consumerProfileGroup
        });
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
