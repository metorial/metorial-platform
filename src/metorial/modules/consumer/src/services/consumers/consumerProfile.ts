import { conflictError, notFoundError, ServiceError } from '@lowerdeck/error';
import { generatePlainId } from '@lowerdeck/id';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { createOrganizationActorAuditScope } from '@metorial/audit-scope';
import {
  getEffectiveConsumerGroups,
  normalizeStringList,
  type EffectiveConsumerGroup
} from '@metorial/consumer-auth';
import {
  ConsumerGroup,
  ConsumerProfile,
  ConsumerProfileGroupAssignedVia,
  ConsumerProfileInviteStatus,
  ConsumerSurface,
  db,
  ID,
  Instance,
  InstanceConsumer,
  Organization,
  OrganizationMember,
  Prisma,
  User,
  withTransaction
} from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { createLock } from '@metorial/lock';
import { namespaceService, organizationActorService } from '@metorial/module-organization';
import { searchConsumerIds } from '@metorial/module-search';
import {
  consumerEmailEquals,
  normalizeConsumerEmail,
  normalizeConsumerEmails
} from '../../lib/consumerEmail';
import { consumerInviteUpdatedQueue } from '../../queues/lifecycle/consumerInvite';
import {
  consumerProfileCreatedQueue,
  consumerProfileUpdatedQueue
} from '../../queues/lifecycle/consumerProfile';
import { reconcileUserConsumersQueue } from '../../queues/reconcileUserConsumer';
import { syncUserConsumersQueue } from '../../queues/syncUserConsumer';
import { consumerService } from './consumer';
import type { EnrichedConsumerSurface } from './consumerSurface';
import { consumerSurfaceInclude, consumerSurfaceService } from './consumerSurface';

let include = {
  consumer: {
    include: {
      user: true
    }
  },
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

  private async resolveOrganizationIdentity(d: {
    consumerProfile?: ConsumerProfile;
    surface: ConsumerSurface;
    organization: Organization;
    instanceConsumer: InstanceConsumer;
    member?: OrganizationMember;
    name: string;
    email: string;
  }): Promise<{
    organizationMemberOid: bigint | null;
    organizationActorOid: bigint;
  }> {
    return withTransaction(
      async db => {
        if (d.surface.type === 'organization_members') {
          let organizationMemberOid =
            d.member?.oid ??
            d.consumerProfile?.organizationMemberOid ??
            d.instanceConsumer.organizationMemberOid;

          if (!organizationMemberOid) {
            let consumer = await db.consumer.findUnique({
              where: { oid: d.instanceConsumer.consumerOid },
              select: { organizationMemberOid: true }
            });
            organizationMemberOid = consumer?.organizationMemberOid ?? null;
          }

          let member = organizationMemberOid
            ? await db.organizationMember.findUnique({
                where: { oid: organizationMemberOid }
              })
            : null;

          if (!member) {
            throw new ServiceError(notFoundError('organization_member'));
          }

          return {
            organizationMemberOid: member.oid,
            organizationActorOid: member.actorOid
          };
        }

        let currentOrganizationActor = d.consumerProfile?.organizationActorOid
          ? await db.organizationActor.findUnique({
              where: { oid: d.consumerProfile.organizationActorOid }
            })
          : null;
        if (currentOrganizationActor?.type === 'consumer_profile') {
          return {
            organizationMemberOid: null,
            organizationActorOid: currentOrganizationActor.oid
          };
        }

        let systemActor = await organizationActorService.getSystemActor({
          organization: d.organization
        });
        let organizationActor = await organizationActorService.createOrganizationActor({
          input: {
            type: 'consumer_profile',
            name: d.name,
            email: d.email
          },
          organization: d.organization,
          auditScope: createOrganizationActorAuditScope({
            organization: d.organization,
            organizationActor: systemActor,
            instance: { oid: d.instanceConsumer.instanceOid },
            context: { ip: '0.0.0.0', ua: 'Metorial System' }
          })
        });

        await db.consumerOrganizationActor.upsert({
          where: {
            consumerOid_organizationActorOid: {
              consumerOid: d.instanceConsumer.consumerOid,
              organizationActorOid: organizationActor.oid
            }
          },
          create: {
            consumerOid: d.instanceConsumer.consumerOid,
            organizationActorOid: organizationActor.oid
          },
          update: {}
        });

        return {
          organizationMemberOid: null,
          organizationActorOid: organizationActor.oid
        };
      },
      { ifExists: true }
    );
  }

  async reconcileConsumerProfileOrganizationActor(d: { consumerProfile: ConsumerProfile }) {
    return await ensureProfileLock.usingLock(
      `${d.consumerProfile.instanceOid}-${normalizeConsumerEmail(d.consumerProfile.email)}`,
      async () =>
        await withTransaction(async db => {
          let consumerProfile = await db.consumerProfile.findUnique({
            where: { oid: d.consumerProfile.oid },
            include: {
              organization: true,
              surface: true
            }
          });
          if (!consumerProfile) return null;

          let instanceConsumer = await db.instanceConsumer.findUnique({
            where: {
              instanceOid_consumerOid: {
                instanceOid: consumerProfile.instanceOid,
                consumerOid: consumerProfile.consumerOid
              }
            }
          });
          if (!instanceConsumer) return null;

          let organizationIdentity = await this.resolveOrganizationIdentity({
            consumerProfile,
            surface: consumerProfile.surface,
            organization: consumerProfile.organization,
            instanceConsumer,
            name: consumerProfile.name,
            email: consumerProfile.email
          });

          if (
            consumerProfile.organizationMemberOid ===
              organizationIdentity.organizationMemberOid &&
            consumerProfile.organizationActorOid === organizationIdentity.organizationActorOid
          ) {
            return consumerProfile;
          }

          return await db.consumerProfile.update({
            where: { oid: consumerProfile.oid },
            data: organizationIdentity
          });
        })
    );
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
    let emails = normalizeConsumerEmails(d.emails);
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

  async activateConsumerProfile(d: { consumerProfile: Pick<ConsumerProfile, 'oid'> }) {
    let { consumerProfile, updatedInviteIds, wasActivated } = await withTransaction(
      async db => {
        let existingProfile = await db.consumerProfile.findUniqueOrThrow({
          where: {
            oid: d.consumerProfile.oid
          },
          include
        });

        if (existingProfile.inviteStatus != 'invited') {
          return {
            consumerProfile: existingProfile,
            updatedInviteIds: [],
            wasActivated: false
          };
        }

        await Fabric.fire('consumer.profile.updated:before', {
          consumerProfile: existingProfile,
          surface: existingProfile.surface
        });

        let consumerProfile = await db.consumerProfile.update({
          where: {
            oid: existingProfile.oid
          },
          data: {
            inviteStatus: 'accepted'
          },
          include
        });
        let pendingInvites = await db.consumerInvite.findMany({
          where: {
            consumerProfileOid: existingProfile.oid,
            status: 'pending'
          },
          select: {
            id: true
          }
        });
        let updatedInviteIds = pendingInvites.map(invite => invite.id);

        if (updatedInviteIds.length) {
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
          consumerProfile,
          updatedInviteIds,
          wasActivated: true
        };
      }
    );

    if (!wasActivated) return consumerProfile;

    await Fabric.fire('consumer.profile.updated:after', {
      consumerProfile,
      surface: consumerProfile.surface
    });
    await consumerProfileUpdatedQueue.add({ consumerProfileId: consumerProfile.id });

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

    return consumerProfile;
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
    let email = normalizeConsumerEmail(d.email);
    let res = await ensureProfileLock.usingLock(
      `${d.surface.instanceOid}-${email}`,
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
            email
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
                  email: consumerEmailEquals(email),
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

            let nextInviteStatus = d.inviteStatus ?? existingProfile.inviteStatus;
            let shouldActivate =
              (d.aresUserId && existingProfile.inviteStatus == 'invited') ||
              (nextInviteStatus == 'accepted' && existingProfile.inviteStatus != 'accepted');

            let organizationIdentity = await this.resolveOrganizationIdentity({
              consumerProfile: existingProfile,
              surface: d.surface,
              organization,
              instanceConsumer,
              member: d.member,
              name: d.name,
              email
            });

            let consumerProfile = await db.consumerProfile.update({
              where: {
                oid: existingProfile.oid
              },
              data: {
                status: 'active',
                aresUserId: d.aresUserId,
                email,
                name: d.name,
                inviteStatus: shouldActivate ? existingProfile.inviteStatus : nextInviteStatus,
                consumerOid: instanceConsumer.consumerOid,
                deletedAt: null,
                ssoGroupIds,
                ssoRoles,

                ...organizationIdentity
              },
              include
            });

            return {
              lifecycleAction: 'updated' as const,
              instanceConsumer,
              consumerProfile,
              shouldActivate
            };
          }

          await Fabric.fire('consumer.profile.created:before', {
            surface: d.surface
          });

          let organizationIdentity = await this.resolveOrganizationIdentity({
            surface: d.surface,
            organization,
            instanceConsumer,
            member: d.member,
            name: d.name,
            email
          });

          let accessTag = await db.accessTag.create({
            data: { instanceOid: d.surface.instanceOid }
          });

          let personalConsumerGroup = await db.consumerGroup.create({
            data: {
              id: await ID.generateId('consumerGroup'),
              status: 'active',
              type: 'user_access',
              isDefault: false,
              ssoGroupIds: [],
              name: `Personal Group for ${email}`,
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
                email,
                name: d.name,
                inviteStatus: d.inviteStatus ?? 'unset',
                ssoGroupIds,
                ssoRoles,
                organizationOid: d.surface.organizationOid,
                instanceOid: d.surface.instanceOid,
                surfaceOid: d.surface.oid,
                consumerOid: instanceConsumer.consumerOid,
                accessTagOid: accessTag.oid,
                personalConsumerGroupOid: personalConsumerGroup.oid,

                ...organizationIdentity
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

    let consumerProfile =
      res.lifecycleAction == 'updated' && res.shouldActivate
        ? await this.activateConsumerProfile({ consumerProfile: res.consumerProfile })
        : res.consumerProfile;

    return await this.enrichConsumerProfile({
      consumerProfile,
      instanceConsumer: res.instanceConsumer
    });
  }

  async getStoredGroupsForProfiles(d: {
    consumerSurface: ConsumerSurface;
    consumerProfiles: Array<
      ConsumerProfileWithRelations & {
        personalConsumerGroup: ConsumerGroup;
        groups: Array<{
          group: ConsumerGroup;
          assignedVia?: ConsumerProfileGroupAssignedVia;
        }>;
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
      let membershipByGroupOid = new Map(
        consumerProfile.groups.map(membership => [membership.group.oid, membership])
      );
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

        let membership = membershipByGroupOid.get(group.oid);
        if (membership) {
          return [toAssignedGroup(group, membership.assignedVia ?? 'manual')];
        }

        return [];
      });
    }

    return groupsByProfile;
  }

  async assignToGroups<T extends ConsumerProfileWithRelations>(d: {
    consumerProfile: T;
    groupIds: string[];
    assignedVia?: ConsumerProfileGroupAssignedVia;
  }) {
    let groups = await this.getAssignableGroupsOrThrow(d);
    let assignedVia = d.assignedVia ?? 'manual';

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
        let existingByGroupOid = new Map(
          existingMemberships.map(membership => [membership.groupOid, membership])
        );

        for (let group of groups) {
          let existing = existingByGroupOid.get(group.oid);

          if (existing) {
            if (existing.assignedVia != assignedVia && assignedVia == 'sso') {
              await db.consumerProfileGroup.update({
                where: { oid: existing.oid },
                data: { assignedVia }
              });
            }

            continue;
          }

          await Fabric.fire('consumer.profile.group.added:before', {
            consumerProfile: d.consumerProfile,
            consumerGroup: group
          });

          let consumerProfileGroup = await db.consumerProfileGroup.create({
            data: {
              profileOid: d.consumerProfile.oid,
              groupOid: group.oid,
              assignedVia
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
    assignedVia?: ConsumerProfileGroupAssignedVia;
  }) {
    let groups = await this.getAssignableGroupsOrThrow(d);
    let assignedVia = d.assignedVia ?? 'manual';

    await withTransaction(async db => {
      let existingMemberships = await db.consumerProfileGroup.findMany({
        where: {
          profileOid: d.consumerProfile.oid,
          groupOid: { in: groups.map(group => group.oid) },
          assignedVia
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

  private async resolveConsumersForUserInternal(d: {
    user: User;
    strict?: boolean;
    consumerSurface?: ConsumerSurface;
  }) {
    let profileWhere = {
      status: 'active' as const,
      surfaceOid: d.consumerSurface?.oid
    };

    return await db.consumer.findMany({
      where: {
        OR: [
          { userOid: d.user.oid },

          ...(!d.strict
            ? [
                d.user.globalProfileOid
                  ? { globalProfileOid: d.user.globalProfileOid, userOid: null }
                  : undefined!,
                { email: consumerEmailEquals(d.user.email), userOid: null },
                { organizationMember: { userOid: d.user.oid } }
              ]
            : []
          ).filter(Boolean)
        ],

        profiles: d.consumerSurface ? { some: profileWhere } : undefined
      },
      include: {
        profiles: {
          include: {
            ...include,
            instance: {
              include: {
                project: true
              }
            }
          },
          where: profileWhere
        },
        organization: true
      }
    });
  }

  private async getConsumersForUserInternal(d: {
    user: User;
    consumerSurface?: ConsumerSurface;
  }) {
    let consumerProfiles = await this.resolveConsumersForUserInternal(d);

    let consumersToPatch = consumerProfiles.filter(consumer => !consumer.userOid);
    let consumerCountByOrganizationOid = new Map<string, number>();
    for (let consumer of consumerProfiles) {
      let key = consumer.organizationOid.toString();
      consumerCountByOrganizationOid.set(
        key,
        (consumerCountByOrganizationOid.get(key) ?? 0) + 1
      );
    }
    let hasDuplicateConsumers = Array.from(consumerCountByOrganizationOid.values()).some(
      count => count > 1
    );

    if (!consumersToPatch.length) {
      if (hasDuplicateConsumers) {
        await reconcileUserConsumersQueue.add({ userId: d.user.id });
      }
      return consumerProfiles;
    }

    await db.consumer.updateMany({
      where: {
        oid: { in: consumersToPatch.map(consumer => consumer.oid) },
        userOid: null
      },
      data: {
        userOid: d.user.oid
      }
    });

    await reconcileUserConsumersQueue.add({ userId: d.user.id });
    await syncUserConsumersQueue.add({ userId: d.user.id });

    return await this.resolveConsumersForUserInternal({
      user: d.user,
      strict: true,
      consumerSurface: d.consumerSurface
    });
  }

  async getConsumersForUser(d: { user: User }) {
    let consumers = await this.getConsumersForUserInternal(d);

    let namespacesByPortalOid = await namespaceService.getNamespacePropertiesByPortalOid({
      portals: consumers.flatMap(consumer =>
        consumer.profiles.flatMap(profile => profile.surface.portal ?? [])
      )
    });

    return consumers.map(consumer => ({
      ...consumer,
      profiles: consumer.profiles.map(profile => ({
        ...profile,
        surface: {
          ...profile.surface,
          portal: profile.surface.portal
            ? {
                ...profile.surface.portal,
                namespaces: namespacesByPortalOid.get(profile.surface.portal.oid) ?? []
              }
            : null
        }
      }))
    }));
  }

  async getConsumerProfileForUserAndSurface(d: {
    user: User;
    consumerSurface: ConsumerSurface;
  }) {
    let consumers = await this.getConsumersForUserInternal({
      user: d.user,
      consumerSurface: d.consumerSurface
    });

    let consumer = consumers[0];
    if (!consumer) {
      throw new ServiceError(notFoundError('consumer.profile'));
    }

    let consumerProfile = consumer.profiles[0];
    if (!consumerProfile || consumerProfile.surfaceOid !== d.consumerSurface.oid) {
      throw new ServiceError(notFoundError('consumer.profile'));
    }

    return consumerProfile;
  }
}

export let consumerProfileService = Service.create(
  'consumerProfileService',
  () => new ConsumerProfileServiceImpl()
).build();
