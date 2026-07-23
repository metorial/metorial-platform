import { db, ID } from '@metorial/db';
import { recordMigrationArtifact } from './artifacts';

let mergeActorCollisions = async (
  sourceActorOid: bigint,
  targetActorOid: bigint,
  resourceGroupOid: bigint,
  fence: () => Promise<void>
) => {
  return await db.$transaction(async db => {
    let skillParticipants = await db.skillParticipant.findMany({
      where: { resourceActorOid: sourceActorOid, skill: { resourceGroupOid } }
    });
    for (let source of skillParticipants) {
      await fence();
      let target = await db.skillParticipant.findUnique({
        where: {
          skillOid_resourceActorOid: {
            skillOid: source.skillOid,
            resourceActorOid: targetActorOid
          }
        }
      });
      if (!target) {
        await db.skillParticipant.update({
          where: { oid: source.oid },
          data: { resourceActorOid: targetActorOid }
        });
        continue;
      }
      await db.skillParticipant.update({
        where: { oid: target.oid },
        data: { roles: [...new Set([...target.roles, ...source.roles])] }
      });
      await db.skillParticipant.delete({ where: { oid: source.oid } });
    }

    let storeParticipants = await db.storeParticipant.findMany({
      where: { resourceActorOid: sourceActorOid, store: { resourceGroupOid } }
    });
    for (let source of storeParticipants) {
      await fence();
      let target = await db.storeParticipant.findUnique({
        where: {
          storeOid_resourceActorOid: {
            storeOid: source.storeOid,
            resourceActorOid: targetActorOid
          }
        }
      });
      if (!target) {
        await db.storeParticipant.update({
          where: { oid: source.oid },
          data: { resourceActorOid: targetActorOid }
        });
        continue;
      }
      await db.storeParticipant.update({
        where: { oid: target.oid },
        data: { permissions: [...new Set([...target.permissions, ...source.permissions])] }
      });
      await db.storeParticipant.delete({ where: { oid: source.oid } });
    }

    let documentParticipants = await db.documentParticipant.findMany({
      where: { resourceActorOid: sourceActorOid, document: { resourceGroupOid } }
    });
    for (let source of documentParticipants) {
      await fence();
      let target = await db.documentParticipant.findUnique({
        where: {
          documentOid_resourceActorOid: {
            documentOid: source.documentOid,
            resourceActorOid: targetActorOid
          }
        }
      });
      if (!target) {
        await db.documentParticipant.update({
          where: { oid: source.oid },
          data: { resourceActorOid: targetActorOid }
        });
        continue;
      }
      await db.documentParticipant.update({
        where: { oid: target.oid },
        data: {
          role: target.role == 'editor' || source.role == 'editor' ? 'editor' : 'viewer',
          editCount: target.editCount + source.editCount,
          createdAt: target.createdAt < source.createdAt ? target.createdAt : source.createdAt,
          lastEditedAt:
            !target.lastEditedAt ||
            (source.lastEditedAt && source.lastEditedAt > target.lastEditedAt)
              ? source.lastEditedAt
              : target.lastEditedAt,
          lastViewedAt:
            !target.lastViewedAt ||
            (source.lastViewedAt && source.lastViewedAt > target.lastViewedAt)
              ? source.lastViewedAt
              : target.lastViewedAt
        }
      });
      await db.documentParticipant.delete({ where: { oid: source.oid } });
    }

    let editors = await db.documentVersionEditors.findMany({
      where: {
        resourceActorOid: sourceActorOid,
        documentVersion: { resourceGroupOid }
      }
    });
    for (let source of editors) {
      await fence();
      let target = await db.documentVersionEditors.findUnique({
        where: {
          documentVersionOid_resourceActorOid: {
            documentVersionOid: source.documentVersionOid,
            resourceActorOid: targetActorOid
          }
        }
      });
      if (target) {
        await db.documentVersionEditors.delete({ where: { oid: source.oid } });
      } else {
        await db.documentVersionEditors.update({
          where: { oid: source.oid },
          data: { resourceActorOid: targetActorOid }
        });
      }
    }
  });
};

let ensureCanonicalProfileActor = async (d: {
  resourceTenantOid: bigint;
  profile: { oid: bigint; id: string; name: string; consumerOid: bigint };
}) =>
  await db.resourceActor.upsert({
    where: {
      resourceTenantOid_consumerProfileOid: {
        resourceTenantOid: d.resourceTenantOid,
        consumerProfileOid: d.profile.oid
      }
    },
    create: {
      id: await ID.generateId('resourceActor'),
      identifier: `mte-cpf-${d.profile.id}`,
      name: d.profile.name,
      type: 'external',
      resourceTenantOid: d.resourceTenantOid,
      consumerOid: d.profile.consumerOid,
      consumerProfileOid: d.profile.oid
    },
    update: {
      identifier: `mte-cpf-${d.profile.id}`,
      name: d.profile.name,
      consumerOid: d.profile.consumerOid
    }
  });

let repointActorEverywhere = async (
  sourceActorOid: bigint,
  targetActorOid: bigint,
  fence: () => Promise<void>
) => {
  let source = await db.resourceActor.findUniqueOrThrow({
    where: { oid: sourceActorOid }
  });
  let groups = await db.resourceGroup.findMany({
    where: { resourceTenantOid: source.resourceTenantOid },
    select: { oid: true }
  });
  for (let group of groups) {
    await mergeActorCollisions(sourceActorOid, targetActorOid, group.oid, fence);
  }
  await fence();
  await db.$transaction(async db => {
    await Promise.all([
      db.skill.updateMany({
        where: { createdByResourceActorOid: sourceActorOid },
        data: { createdByResourceActorOid: targetActorOid }
      }),
      db.store.updateMany({
        where: { createdByResourceActorOid: sourceActorOid },
        data: { createdByResourceActorOid: targetActorOid }
      }),
      db.document.updateMany({
        where: { createdByResourceActorOid: sourceActorOid },
        data: { createdByResourceActorOid: targetActorOid }
      }),
      db.file.updateMany({
        where: { createdByResourceActorOid: sourceActorOid },
        data: { createdByResourceActorOid: targetActorOid }
      }),
      db.fileLink.updateMany({
        where: { createdByResourceActorOid: sourceActorOid },
        data: { createdByResourceActorOid: targetActorOid }
      }),
      db.skillExport.updateMany({
        where: { creatorResourceActorOid: sourceActorOid },
        data: { creatorResourceActorOid: targetActorOid }
      }),
      db.skillImport.updateMany({
        where: { creatorResourceActorOid: sourceActorOid },
        data: { creatorResourceActorOid: targetActorOid }
      }),
      db.skillForkSync.updateMany({
        where: { createdByResourceActorOid: sourceActorOid },
        data: { createdByResourceActorOid: targetActorOid }
      }),
      db.storeItem.updateMany({
        where: { lastModifiedByResourceActorOid: sourceActorOid },
        data: { lastModifiedByResourceActorOid: targetActorOid }
      }),
      db.skillMergeRequestItem.updateMany({
        where: { resolvedByResourceActorOid: sourceActorOid },
        data: { resolvedByResourceActorOid: targetActorOid }
      }),
      db.skillMergeRequestComment.updateMany({
        where: { resourceActorOid: sourceActorOid },
        data: { resourceActorOid: targetActorOid }
      }),
      db.skillMergeRequestEvent.updateMany({
        where: { resourceActorOid: sourceActorOid },
        data: { resourceActorOid: targetActorOid }
      })
    ]);
    for (let field of [
      'createdByResourceActorOid',
      'mergeStartedByResourceActorOid',
      'mergedByResourceActorOid',
      'closedByResourceActorOid',
      'rolledBackByResourceActorOid'
    ] as const) {
      await fence();
      await db.skillMergeRequest.updateMany({
        where: { [field]: sourceActorOid },
        data: { [field]: targetActorOid }
      });
    }
    await db.resourceActor.delete({ where: { oid: sourceActorOid } });
  });
};

export let reconcileLegacyConsumerActors = async (d: {
  runId: string;
  fence: () => Promise<void>;
}) => {
  let decisionKeys: string[] = [];
  let unresolved = 0;
  let ambiguous = 0;
  let reconciled = 0;
  let memberActors = await db.resourceActor.findMany({
    where: {
      consumerProfileOid: null,
      consumerOid: { not: null },
      organizationActorOid: { not: null }
    },
    include: { organizationActor: true }
  });
  for (let actor of memberActors) {
    await d.fence();
    let duplicate = await db.resourceActor.findFirst({
      where: {
        oid: { not: actor.oid },
        resourceTenantOid: actor.resourceTenantOid,
        organizationActorOid: actor.organizationActorOid
      }
    });
    if (duplicate) {
      await repointActorEverywhere(actor.oid, duplicate.oid, d.fence);
      decisionKeys.push(`member:${actor.oid}`);
      await recordMigrationArtifact({
        runId: d.runId,
        stage: 'actor_reconciliation',
        kind: 'actor_decision',
        recordKey: `member:${actor.oid}`,
        classification: 'selected',
        payload: {
          actorOid: actor.oid,
          canonicalActorOid: duplicate.oid,
          reason: 'member_actor_merged_into_organization_actor'
        }
      });
      continue;
    }
    await db.resourceActor.update({
      where: { oid: actor.oid },
      data: {
        identifier: `mte-oac-${actor.organizationActor!.id}`,
        name: actor.organizationActor!.name,
        consumerOid: null
      }
    });
  }

  let actors = await db.resourceActor.findMany({
    where: {
      consumerOid: { not: null },
      consumerProfileOid: null,
      organizationActorOid: null
    },
    include: { resourceTenant: true }
  });
  for (let actor of actors) {
    await d.fence();
    let selectedProfileOids: bigint[] = [];
    let groups = await db.resourceGroup.findMany({
      where: {
        resourceTenantOid: actor.resourceTenantOid,
        OR: [
          { skills: { some: { createdByResourceActorOid: actor.oid } } },
          {
            skills: {
              some: { skillParticipants: { some: { resourceActorOid: actor.oid } } }
            }
          },
          { stores: { some: { createdByResourceActorOid: actor.oid } } },
          {
            stores: {
              some: { storeParticipants: { some: { resourceActorOid: actor.oid } } }
            }
          },
          { documents: { some: { createdByResourceActorOid: actor.oid } } },
          {
            documents: {
              some: { documentParticipants: { some: { resourceActorOid: actor.oid } } }
            }
          },
          { files: { some: { createdByResourceActorOid: actor.oid } } }
        ]
      },
      include: { instance: true }
    });
    let additionalGroupOids = (
      await Promise.all([
        db.fileLink.findMany({
          where: { createdByResourceActorOid: actor.oid },
          select: { resourceGroupOid: true }
        }),
        db.skillExport.findMany({
          where: { creatorResourceActorOid: actor.oid },
          select: { resourceGroupOid: true }
        }),
        db.skillImport.findMany({
          where: { creatorResourceActorOid: actor.oid },
          select: { resourceGroupOid: true }
        }),
        db.skillMergeRequest.findMany({
          where: {
            OR: [
              { createdByResourceActorOid: actor.oid },
              { mergeStartedByResourceActorOid: actor.oid },
              { mergedByResourceActorOid: actor.oid },
              { closedByResourceActorOid: actor.oid },
              { rolledBackByResourceActorOid: actor.oid }
            ]
          },
          select: { resourceGroupOid: true }
        }),
        db.skillForkSync.findMany({
          where: { createdByResourceActorOid: actor.oid },
          select: { resourceGroupOid: true }
        }),
        db.skillMergeRequestItem.findMany({
          where: { resolvedByResourceActorOid: actor.oid },
          select: {
            skillMergeRequest: { select: { resourceGroupOid: true } }
          }
        }),
        db.skillMergeRequestComment.findMany({
          where: { resourceActorOid: actor.oid },
          select: {
            skillMergeRequest: { select: { resourceGroupOid: true } }
          }
        }),
        db.skillMergeRequestEvent.findMany({
          where: { resourceActorOid: actor.oid },
          select: {
            skillMergeRequest: { select: { resourceGroupOid: true } }
          }
        }),
        db.storeItem.findMany({
          where: { lastModifiedByResourceActorOid: actor.oid },
          select: { store: { select: { resourceGroupOid: true } } }
        }),
        db.documentVersionEditors.findMany({
          where: { resourceActorOid: actor.oid },
          select: {
            documentVersion: { select: { resourceGroupOid: true } }
          }
        })
      ])
    ).flatMap(rows =>
      rows.map(row => {
        if ('resourceGroupOid' in row) return row.resourceGroupOid;
        if ('skillMergeRequest' in row) return row.skillMergeRequest.resourceGroupOid;
        if ('store' in row) return row.store.resourceGroupOid;
        return row.documentVersion.resourceGroupOid;
      })
    );
    let knownGroupOids = new Set(groups.map(group => group.oid));
    let missingGroupOids = additionalGroupOids.filter(
      (oid): oid is bigint => oid != null && !knownGroupOids.has(oid)
    );
    if (missingGroupOids.length) {
      groups.push(
        ...(await db.resourceGroup.findMany({
          where: { oid: { in: [...new Set(missingGroupOids)] } },
          include: { instance: true }
        }))
      );
    }

    if (groups.length == 0) {
      decisionKeys.push(actor.oid.toString());
      unresolved++;
      await recordMigrationArtifact({
        runId: d.runId,
        stage: 'actor_reconciliation',
        kind: 'actor_decision',
        recordKey: actor.oid.toString(),
        classification: 'unresolved',
        payload: {
          actorOid: actor.oid,
          consumerOid: actor.consumerOid,
          reason: 'no_resource_group_can_be_established'
        }
      });
      continue;
    }

    for (let group of groups) {
      await d.fence();
      if (!group.instance) {
        decisionKeys.push(`${actor.oid}:${group.oid}`);
        unresolved++;
        await recordMigrationArtifact({
          runId: d.runId,
          stage: 'actor_reconciliation',
          kind: 'actor_decision',
          recordKey: `${actor.oid}:${group.oid}`,
          classification: 'unresolved',
          payload: {
            actorOid: actor.oid,
            resourceGroupOid: group.oid,
            reason: 'resource_group_is_not_instance_owned'
          }
        });
        continue;
      }
      let profiles = await db.consumerProfile.findMany({
        where: {
          consumerOid: actor.consumerOid!,
          instanceOid: group.instance.oid,
          surface: {
            type: 'portal',
            portal: { isNot: null }
          }
        },
        include: {
          consumerSkills: {
            select: {
              oid: true,
              skillOid: true,
              cargoStoreParticipantId: true,
              permissions: true
            }
          },
          personalConsumerGroup: true,
          groups: { include: { group: true } },
          accessTag: { include: { accessTagEntities: true } },
          surface: { include: { portal: true } }
        },
        orderBy: [{ status: 'asc' }, { createdAt: 'asc' }, { oid: 'asc' }]
      });
      let activeProfiles = profiles.filter(
        profile =>
          profile.status == 'active' &&
          profile.surface.status == 'active' &&
          profile.surface.portal?.status == 'active'
      );
      if (activeProfiles.length == 0) {
        let crossInstanceProfiles = await db.consumerProfile.count({
          where: {
            consumerOid: actor.consumerOid!,
            instanceOid: { not: group.instance.oid },
            instance: { resourceTenantOid: actor.resourceTenantOid },
            status: 'active',
            surface: {
              type: 'portal',
              status: 'active',
              portal: { status: 'active' }
            }
          }
        });
        decisionKeys.push(`${actor.oid}:${group.oid}`);
        unresolved++;
        await recordMigrationArtifact({
          runId: d.runId,
          stage: 'actor_reconciliation',
          kind: 'actor_decision',
          recordKey: `${actor.oid}:${group.oid}`,
          classification: 'unresolved',
          payload: {
            actorOid: actor.oid,
            resourceGroupOid: group.oid,
            candidateCount: profiles.length,
            crossInstanceCandidateCount: crossInstanceProfiles,
            reason:
              profiles.length > 0
                ? 'only_inactive_portal_profiles_in_resource_group'
                : crossInstanceProfiles > 0
                  ? 'only_cross_instance_portal_profiles'
                  : 'no_portal_profile_in_resource_group'
          }
        });
        continue;
      }
      profiles = activeProfiles;
      let relevantSkills = await db.skill.findMany({
        where: {
          resourceGroupOid: group.oid,
          OR: [
            { createdByResourceActorOid: actor.oid },
            { skillParticipants: { some: { resourceActorOid: actor.oid } } },
            {
              store: {
                OR: [
                  { createdByResourceActorOid: actor.oid },
                  { storeParticipants: { some: { resourceActorOid: actor.oid } } }
                ]
              }
            }
          ]
        },
        select: { oid: true, createdByConsumerProfileOid: true }
      });
      let relevantSkillOids = relevantSkills.map(skill => skill.oid);
      let scored = (
        await Promise.all(
          profiles.map(async profile => {
            let ordinaryTagOids = profile.groups
              .filter(item => item.group.status == 'active')
              .map(item => item.group.accessTagOid);
            let tagEntities = await db.accessTagEntity.findMany({
              where: {
                accessTagOid: {
                  in: [
                    profile.accessTagOid,
                    profile.personalConsumerGroup.accessTagOid,
                    ...ordinaryTagOids
                  ]
                },
                OR: [
                  { skillOid: { in: relevantSkillOids } },
                  {
                    skillGroup: {
                      status: 'active',
                      items: {
                        some: {
                          status: 'active',
                          skillOid: { in: relevantSkillOids }
                        }
                      }
                    }
                  }
                ]
              },
              include: { accessTagPolicy: true }
            });
            let personalAccess = await db.consumerAccess.count({
              where: {
                consumerGroupOid: profile.personalConsumerGroupOid,
                type: 'skill',
                skillOid: { in: relevantSkillOids }
              }
            });
            let directProfile = tagEntities.filter(
              entity => entity.accessTagOid == profile.accessTagOid && entity.skillOid != null
            ).length;
            let personalGroup = tagEntities.filter(
              entity =>
                entity.accessTagOid == profile.personalConsumerGroup.accessTagOid &&
                entity.skillOid != null
            ).length;
            let ordinaryGroup = tagEntities.filter(
              entity =>
                ordinaryTagOids.includes(entity.accessTagOid) && entity.skillOid != null
            ).length;
            let inheritedGroup = tagEntities.filter(
              entity => entity.skillGroupOid != null
            ).length;
            let roleStrength = tagEntities.reduce(
              (strength, entity) =>
                strength +
                (entity.accessTagPolicy.roles.some(role => role.endsWith(':manage_access'))
                  ? 3
                  : entity.accessTagPolicy.roles.some(role => role.endsWith(':write'))
                    ? 2
                    : entity.accessTagPolicy.roles.some(role => role.endsWith(':read'))
                      ? 1
                      : 0),
              0
            );
            let creator = relevantSkills.filter(
              skill => skill.createdByConsumerProfileOid == profile.oid
            ).length;
            let consumerSkill = profile.consumerSkills.filter(item =>
              relevantSkillOids.includes(item.skillOid)
            ).length;
            let cargoParticipant = profile.consumerSkills.filter(
              item =>
                relevantSkillOids.includes(item.skillOid) &&
                item.cargoStoreParticipantId != null
            ).length;
            let evidence =
              creator * 1_000_000_000 +
              (consumerSkill + cargoParticipant) * 10_000_000 +
              personalAccess * 1_000_000 +
              directProfile * 100_000 +
              personalGroup * 10_000 +
              ordinaryGroup * 1_000 +
              inheritedGroup * 100 +
              roleStrength * 10 +
              (profile.status == 'active' ? 8 : 0) +
              (profile.surface.status == 'active' ? 4 : 0) +
              (profile.surface.portal?.status == 'active' ? 2 : 0);
            return {
              profile,
              exact: creator + consumerSkill + cargoParticipant,
              evidence,
              evidenceBreakdown: {
                creator,
                consumerSkill,
                cargoParticipant,
                personalAccess,
                directProfile,
                personalGroup,
                ordinaryGroup,
                inheritedGroup,
                roleStrength
              }
            };
          })
        )
      ).sort(
        (a, b) =>
          b.exact - a.exact ||
          b.evidence - a.evidence ||
          a.profile.createdAt.getTime() - b.profile.createdAt.getTime() ||
          (a.profile.oid < b.profile.oid ? -1 : 1)
      );
      let selected = scored[0]!;
      let isAmbiguous =
        scored.length > 1 &&
        scored[1]!.exact == selected.exact &&
        scored[1]!.evidence == selected.evidence;
      if (isAmbiguous) {
        ambiguous++;
        decisionKeys.push(`${actor.oid}:${group.oid}`);
        await recordMigrationArtifact({
          runId: d.runId,
          stage: 'actor_reconciliation',
          kind: 'actor_decision',
          recordKey: `${actor.oid}:${group.oid}`,
          classification: 'ambiguous',
          payload: {
            actorOid: actor.oid,
            resourceGroupOid: group.oid,
            candidateProfileOids: scored
              .filter(
                candidate =>
                  candidate.exact == selected.exact && candidate.evidence == selected.evidence
              )
              .map(candidate => candidate.profile.oid),
            reason: 'multiple_equally_supported_active_profiles'
          }
        });
        continue;
      }
      selectedProfileOids.push(selected.profile.oid);

      let existingProfileActor = await db.resourceActor.findUnique({
        where: {
          resourceTenantOid_consumerProfileOid: {
            resourceTenantOid: actor.resourceTenantOid,
            consumerProfileOid: selected.profile.oid
          }
        }
      });
      let canonicalActor =
        groups.length == 1 && !existingProfileActor
          ? await db.resourceActor.update({
              where: { oid: actor.oid },
              data: {
                identifier: `mte-cpf-${selected.profile.id}`,
                name: selected.profile.name,
                consumerProfileOid: selected.profile.oid
              }
            })
          : await ensureCanonicalProfileActor({
              resourceTenantOid: actor.resourceTenantOid,
              profile: selected.profile
            });

      if (canonicalActor.oid != actor.oid) {
        await mergeActorCollisions(actor.oid, canonicalActor.oid, group.oid, d.fence);
      }
      await d.fence();
      await db.$transaction(async db => {
        await Promise.all([
          db.skill.updateMany({
            where: {
              resourceGroupOid: group.oid,
              createdByResourceActorOid: actor.oid
            },
            data: { createdByResourceActorOid: canonicalActor.oid }
          }),
          db.store.updateMany({
            where: {
              resourceGroupOid: group.oid,
              createdByResourceActorOid: actor.oid
            },
            data: { createdByResourceActorOid: canonicalActor.oid }
          }),
          db.document.updateMany({
            where: {
              resourceGroupOid: group.oid,
              createdByResourceActorOid: actor.oid
            },
            data: { createdByResourceActorOid: canonicalActor.oid }
          }),
          db.file.updateMany({
            where: {
              resourceGroupOid: group.oid,
              createdByResourceActorOid: actor.oid
            },
            data: { createdByResourceActorOid: canonicalActor.oid }
          }),
          db.fileLink.updateMany({
            where: {
              resourceGroupOid: group.oid,
              createdByResourceActorOid: actor.oid
            },
            data: { createdByResourceActorOid: canonicalActor.oid }
          }),
          db.skillExport.updateMany({
            where: {
              resourceGroupOid: group.oid,
              creatorResourceActorOid: actor.oid
            },
            data: { creatorResourceActorOid: canonicalActor.oid }
          }),
          db.skillImport.updateMany({
            where: {
              resourceGroupOid: group.oid,
              creatorResourceActorOid: actor.oid
            },
            data: { creatorResourceActorOid: canonicalActor.oid }
          }),
          db.skillForkSync.updateMany({
            where: {
              resourceGroupOid: group.oid,
              createdByResourceActorOid: actor.oid
            },
            data: { createdByResourceActorOid: canonicalActor.oid }
          }),
          db.storeItem.updateMany({
            where: {
              store: { resourceGroupOid: group.oid },
              lastModifiedByResourceActorOid: actor.oid
            },
            data: { lastModifiedByResourceActorOid: canonicalActor.oid }
          }),
          db.skillMergeRequestItem.updateMany({
            where: {
              skillMergeRequest: { resourceGroupOid: group.oid },
              resolvedByResourceActorOid: actor.oid
            },
            data: { resolvedByResourceActorOid: canonicalActor.oid }
          }),
          db.skillMergeRequestComment.updateMany({
            where: {
              skillMergeRequest: { resourceGroupOid: group.oid },
              resourceActorOid: actor.oid
            },
            data: { resourceActorOid: canonicalActor.oid }
          }),
          db.skillMergeRequestEvent.updateMany({
            where: {
              skillMergeRequest: { resourceGroupOid: group.oid },
              resourceActorOid: actor.oid
            },
            data: { resourceActorOid: canonicalActor.oid }
          })
        ]);
        for (let field of [
          'createdByResourceActorOid',
          'mergeStartedByResourceActorOid',
          'mergedByResourceActorOid',
          'closedByResourceActorOid',
          'rolledBackByResourceActorOid'
        ] as const) {
          await db.skillMergeRequest.updateMany({
            where: { resourceGroupOid: group.oid, [field]: actor.oid },
            data: { [field]: canonicalActor.oid }
          });
        }
      });
      reconciled++;
      decisionKeys.push(`${actor.oid}:${group.oid}`);
      await recordMigrationArtifact({
        runId: d.runId,
        stage: 'actor_reconciliation',
        kind: 'actor_decision',
        recordKey: `${actor.oid}:${group.oid}`,
        classification: 'selected',
        payload: {
          actorOid: actor.oid,
          resourceGroupOid: group.oid,
          canonicalActorOid: canonicalActor.oid,
          consumerProfileOid: selected.profile.oid,
          candidateCount: profiles.length,
          exactEvidence: selected.exact,
          accessEvidence: selected.evidence,
          evidenceBreakdown: selected.evidenceBreakdown
        }
      });
    }
    let retainedActor = await db.resourceActor.findUnique({ where: { oid: actor.oid } });
    if (retainedActor && retainedActor.consumerProfileOid == null) {
      await d.fence();
      let unanimousWinnerOids = new Set(selectedProfileOids.map(oid => oid.toString()));
      if (selectedProfileOids.length == groups.length && unanimousWinnerOids.size == 1) {
        let profile = await db.consumerProfile.findUniqueOrThrow({
          where: { oid: selectedProfileOids[0]! }
        });
        let canonical = await db.resourceActor.findUnique({
          where: {
            resourceTenantOid_consumerProfileOid: {
              resourceTenantOid: actor.resourceTenantOid,
              consumerProfileOid: profile.oid
            }
          }
        });
        if (canonical && canonical.oid != actor.oid) {
          await repointActorEverywhere(canonical.oid, actor.oid, d.fence);
        }
        await db.resourceActor.update({
          where: { oid: actor.oid },
          data: {
            identifier: `mte-cpf-${profile.id}`,
            name: profile.name,
            consumerProfileOid: profile.oid
          }
        });
      } else if (selectedProfileOids.length == groups.length) {
        await db.resourceActor.delete({ where: { oid: actor.oid } });
      }
    }
  }

  let staleUnresolved = await db.resourceAuthorizationMigrationArtifact.findMany({
    where: {
      runId: d.runId,
      stage: 'actor_reconciliation',
      kind: 'actor_decision',
      classification: 'unresolved'
    }
  });
  for (let decision of staleUnresolved) {
    await d.fence();
    let actorOidValue = (decision.payload as { actorOid?: string }).actorOid;
    if (!actorOidValue) continue;
    let current = await db.resourceActor.findUnique({
      where: { oid: BigInt(actorOidValue) }
    });
    if (!current || current.consumerProfileOid || current.organizationActorOid) {
      await db.resourceAuthorizationMigrationArtifact.update({
        where: { oid: decision.oid },
        data: {
          classification: 'resolved_on_retry',
          payload: {
            ...(decision.payload as object),
            resolution: 'actor_is_now_canonical_or_merged'
          }
        }
      });
    }
  }

  await db.resourceAuthorizationMigrationArtifact.deleteMany({
    where: {
      runId: d.runId,
      stage: 'actor_reconciliation',
      kind: 'postcondition',
      recordKey: { startsWith: 'referenced_consumer_only:' }
    }
  });
  let referencedConsumerOnlyActors = await db.resourceActor.findMany({
    where: {
      consumerOid: { not: null },
      consumerProfileOid: null,
      organizationActorOid: null,
      OR: [
        { skillParticipants: { some: {} } },
        { storeParticipants: { some: {} } },
        { documentParticipants: { some: {} } },
        { documentVersionEditors: { some: {} } },
        { createdSkills: { some: {} } },
        { createdStores: { some: {} } },
        { createdDocuments: { some: {} } },
        { createdFiles: { some: {} } },
        { createdFileLinks: { some: {} } },
        { createdSkillExports: { some: {} } },
        { createdSkillImports: { some: {} } },
        { createdMergeRequests: { some: {} } },
        { createdSkillForkSyncs: { some: {} } },
        { startedMergeRequests: { some: {} } },
        { mergedMergeRequests: { some: {} } },
        { closedMergeRequests: { some: {} } },
        { rolledBackMergeRequests: { some: {} } },
        { resolvedMergeRequestItems: { some: {} } },
        { skillMergeRequestComments: { some: {} } },
        { skillMergeRequestEvents: { some: {} } },
        { lastModifiedStoreItems: { some: {} } }
      ]
    },
    select: { oid: true, consumerOid: true, resourceTenantOid: true }
  });
  for (let actor of referencedConsumerOnlyActors) {
    await recordMigrationArtifact({
      runId: d.runId,
      stage: 'actor_reconciliation',
      kind: 'postcondition',
      recordKey: `referenced_consumer_only:${actor.oid}`,
      classification: 'unresolved',
      payload: {
        actorOid: actor.oid,
        consumerOid: actor.consumerOid,
        resourceTenantOid: actor.resourceTenantOid,
        reason: 'referenced_consumer_only_actor_remains_after_reconciliation'
      }
    });
  }
  if (referencedConsumerOnlyActors.length > 0) {
    throw new Error(
      `Actor reconciliation left ${referencedConsumerOnlyActors.length} referenced consumer-only ResourceActors.`
    );
  }

  return { actors: actors.length, reconciled, unresolved, ambiguous };
};
