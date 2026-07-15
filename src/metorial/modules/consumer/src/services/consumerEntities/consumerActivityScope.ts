import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { ConsumerProfile, db, Instance } from '@metorial/db';
import { AnyAccessTagSelector } from '@metorial/module-access';

class ConsumerActivityScopeServiceImpl {
  async resolve(d: {
    instance: Instance;
    consumerProfile: Pick<ConsumerProfile, 'oid' | 'instanceOid'>;
    accessTags: AnyAccessTagSelector;
  }) {
    if (d.consumerProfile.instanceOid !== d.instance.oid) {
      throw new ServiceError(notFoundError('consumer.profile'));
    }

    let consumerActor = await db.consumerActor.findFirst({
      where: {
        instanceOid: d.instance.oid,
        consumerProfileOid: d.consumerProfile.oid,
        isDefault: true
      }
    });
    if (!consumerActor) {
      throw new ServiceError(notFoundError('consumer.actor'));
    }

    let magicMcpSessions = await db.magicMcpSession.findMany({
      where: {
        instanceOid: d.instance.oid,
        OR: [
          {
            magicMcpEndpoint: {
              status: 'active',
              consumerProfileOid: d.consumerProfile.oid
            }
          },
          {
            consumerIntegrationSessions: {
              some: {
                consumerProfileOid: d.consumerProfile.oid
              }
            }
          }
        ]
      },
      include: {
        magicMcpEndpoint: {
          select: {
            oid: true,
            id: true,
            consumerProfileOid: true
          }
        },
        magicMcpServer: {
          select: {
            id: true
          }
        }
      }
    });

    return {
      consumerActor,
      magicMcpSessions,
      subspaceSessionIds: magicMcpSessions.map(session => session.subspaceSessionId)
    };
  }
}

export let consumerActivityScopeService = Service.create(
  'consumerActivityScopeService',
  () => new ConsumerActivityScopeServiceImpl()
).build();
