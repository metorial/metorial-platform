import {
  ConsumerSurface,
  db,
  ID,
  Instance,
  Organization,
  withTransaction
} from '@metorial/db';
import { notFoundError, ServiceError } from '@metorial/error';
import { badRequestError } from '@metorial/error/src/defaultErrors';
import { generatePlainId } from '@metorial/id';
import { apiKeyService } from '@metorial/module-machine-access';
import { organizationActorService } from '@metorial/module-organization';
import { Service } from '@metorial/service';
import { slugify } from '../../../../../packages/backend/slugify/src';
import { Paginator } from '../../../../../packages/server/pagination/src';

let include = {
  consumerSurfaceAuthFactors: true,
  publishableApiKey: {
    include: {
      secrets: true
    }
  }
};

class consumerSurfaceServiceImpl {
  async createConsumerSurface(d: {
    input: {
      name: string;
      description?: string;
      sessionExpiryTimeInSeconds: number;
    };
    organization: Organization;
    instance: Instance;
  }) {
    return withTransaction(async db => {
      let publishableApiKey = await apiKeyService.createApiKey({
        kind: 'system_internal',
        instance: d.instance,
        organization: d.organization,
        context: {
          ip: '0.0.0.0',
          ua: 'system'
        },
        type: 'instance_access_token_publishable',
        performedBy: await organizationActorService.getSystemActor({
          organization: d.organization
        }),
        input: {
          name: `Publishable API Key for Consumer Surface ${d.input.name}`
        }
      });

      return await db.consumerSurface.create({
        data: {
          id: await ID.generateId('consumerSurface'),
          status: 'active',
          name: d.input.name,
          description: d.input.description,
          instanceOid: d.instance.oid,
          organizationOid: d.organization.oid,
          publishableApiKeyOid: publishableApiKey.apiKey.oid,
          sessionExpiryTimeInSeconds: d.input.sessionExpiryTimeInSeconds
        },
        include
      });
    });
  }

  async updateConsumerSurface(d: {
    consumerSurface: ConsumerSurface;
    input: {
      name?: string;
      description?: string;
      sessionExpiryTimeInSeconds?: number;

      factors?: (
        | {
            type: 'email_code';
          }
        | {
            type: 'sso';
            ssoTenantId: string;
          }
      )[];
    };
  }) {
    if (d.consumerSurface.status !== 'active') {
      throw new ServiceError(
        badRequestError({
          message: 'Cannot update an inactive consumer surface.'
        })
      );
    }

    return withTransaction(async db => {
      if (d.input.factors) {
        let existingFactors = await db.consumerSurfaceAuthFactor.findMany({
          where: { consumerSurfaceOid: d.consumerSurface.oid }
        });

        let factorsToDelete: bigint[] = [];

        let existingEmailFactor = existingFactors.find(f => f.type === 'email_code');
        let newEmailFactor = d.input.factors.find(f => f.type === 'email_code');

        if (existingEmailFactor && !newEmailFactor) {
          factorsToDelete.push(existingEmailFactor.oid);
        } else if (!existingEmailFactor && newEmailFactor) {
          await db.consumerSurfaceAuthFactor.create({
            data: {
              id: await ID.generateId('consumerSurfaceAuthFactor'),
              type: 'email_code',
              status: 'active',
              name: 'Email Code',
              publicName: 'Login with Email Code',
              emailSlug: `${slugify(d.consumerSurface.name)}-${generatePlainId(8)}`,
              consumerSurfaceOid: d.consumerSurface.oid
            }
          });
        } else if (existingEmailFactor && newEmailFactor) {
          await db.consumerSurfaceAuthFactor.update({
            where: { oid: existingEmailFactor.oid },
            data: { status: 'active' }
          });
        }

        let existingSsoFactors = existingFactors.filter(f => f.type === 'sso');

        let newSsoFactors = d.input.factors.filter(f => f.type === 'sso');
        let newSsoFactorsTenants = await db.ssoTenant.findMany({
          where: {
            id: {
              in: newSsoFactors
                .map(f => (f.type === 'sso' ? f.ssoTenantId : undefined!))
                .filter(Boolean)
            },
            organizationOid: d.consumerSurface.organizationOid
          }
        });
        let newSsoFactorsTenantIds = newSsoFactorsTenants.map(t => t.oid);

        for (let existingFactor of existingSsoFactors) {
          if (!newSsoFactorsTenantIds.includes(existingFactor.ssoTenantOid!)) {
            factorsToDelete.push(existingFactor.oid);
          }
        }

        for (let newFactor of newSsoFactorsTenants) {
          let existingFactor = existingSsoFactors.find(f => f.ssoTenantOid === newFactor.oid);
          if (existingFactor) {
            await db.consumerSurfaceAuthFactor.update({
              where: { oid: existingFactor.oid },
              data: { status: 'active' }
            });
            continue;
          }

          await db.consumerSurfaceAuthFactor.create({
            data: {
              id: await ID.generateId('consumerSurfaceAuthFactor'),
              type: 'sso',
              status: 'active',
              name: `SSO (${newFactor.name})`,
              publicName: `Login with ${newFactor.name}`,
              ssoTenantOid: newFactor.oid,
              consumerSurfaceOid: d.consumerSurface.oid
            }
          });
        }

        if (factorsToDelete.length) {
          await db.consumerSurfaceAuthFactor.updateMany({
            where: { oid: { in: factorsToDelete } },
            data: { status: 'inactive' }
          });
        }
      }

      return await db.consumerSurface.update({
        where: { oid: d.consumerSurface.oid },
        data: {
          name: d.input.name,
          description: d.input.description,
          sessionExpiryTimeInSeconds: d.input.sessionExpiryTimeInSeconds
        },
        include
      });
    });
  }

  async getConsumerSurfacePublic(d: { consumerSurfaceId: string }) {
    let consumerSurface = await db.consumerSurface.findFirst({
      where: { id: d.consumerSurfaceId },
      include
    });
    if (!consumerSurface) throw new ServiceError(notFoundError('consumer.surface'));
    return consumerSurface;
  }

  async getConsumerSurfaceById(d: { organization: Organization; consumerSurfaceId: string }) {
    let consumerSurface = await db.consumerSurface.findFirst({
      where: { id: d.consumerSurfaceId, organizationOid: d.organization.oid },
      include
    });
    if (!consumerSurface) throw new ServiceError(notFoundError('consumer.surface'));
    return consumerSurface;
  }

  async listConsumerSurfaces(d: { organization: Organization }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.consumerSurface.findMany({
            ...opts,
            where: {
              organizationOid: d.organization.oid,
              status: 'active'
            },
            include
          })
      )
    );
  }

  async deleteConsumerSurface(d: { consumerSurface: ConsumerSurface }) {
    if (d.consumerSurface.status !== 'active') {
      throw new ServiceError(
        badRequestError({
          message: 'Consumer surface is already inactive.'
        })
      );
    }

    return withTransaction(async db => {
      await db.consumerSurfaceAuthFactor.updateMany({
        where: { consumerSurfaceOid: d.consumerSurface.oid },
        data: { status: 'inactive' }
      });

      return await db.consumerSurface.update({
        where: { oid: d.consumerSurface.oid },
        data: { status: 'inactive' },
        include
      });
    });
  }
}

export let consumerSurfaceService = Service.create(
  'consumerSurfaceService',
  () => new consumerSurfaceServiceImpl()
).build();
