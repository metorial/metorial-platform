import {
  ConsumerSurface,
  ConsumerSurfaceAuthFactor,
  db,
  ID,
  withTransaction
} from '@metorial/db';
import { notFoundError, ServiceError } from '@metorial/error';
import { badRequestError } from '@metorial/error/src/defaultErrors';
import { generatePlainId } from '@metorial/id';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';
import { slugify } from '@metorial/slugify';

let include = {};

class consumerAuthFactorServiceImpl {
  async listConsumerAuthFactors(d: { consumerSurface: ConsumerSurface }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.consumerSurfaceAuthFactor.findMany({
            ...opts,
            where: {
              consumerSurfaceOid: d.consumerSurface.oid,
              status: 'active'
            },
            include
          })
      )
    );
  }

  async getConsumerAuthFactorById(d: {
    consumerSurface: ConsumerSurface;
    consumerAuthFactorId: string;
  }) {
    let consumerAuthFactor = await db.consumerSurfaceAuthFactor.findFirst({
      where: {
        id: d.consumerAuthFactorId,
        consumerSurfaceOid: d.consumerSurface.oid
      },
      include
    });
    if (!consumerAuthFactor) throw new ServiceError(notFoundError('consumer.auth_factor'));
    return consumerAuthFactor;
  }

  async createConsumerAuthFactor(d: {
    consumerSurface: ConsumerSurface;
    input:
      | {
          type: 'email_code';
        }
      | {
          type: 'sso';
          ssoTenantId: string;
        };
  }) {
    if (d.consumerSurface.status !== 'active') {
      throw new ServiceError(
        badRequestError({
          message: 'Cannot add auth factor to an inactive consumer surface.'
        })
      );
    }

    return withTransaction(async db => {
      if (d.input.type === 'email_code') {
        let existingFactor = await db.consumerSurfaceAuthFactor.findFirst({
          where: {
            consumerSurfaceOid: d.consumerSurface.oid,
            type: 'email_code'
          }
        });
        if (existingFactor && existingFactor.status === 'active') {
          throw new ServiceError(
            badRequestError({
              message: 'Email code auth factor already exists for this consumer surface.'
            })
          );
        }

        if (existingFactor && existingFactor.status !== 'active') {
          return await db.consumerSurfaceAuthFactor.update({
            where: { oid: existingFactor.oid },
            data: { status: 'active' },
            include
          });
        } else {
          return await db.consumerSurfaceAuthFactor.create({
            data: {
              id: await ID.generateId('consumerSurfaceAuthFactor'),
              type: 'email_code',
              status: 'active',
              name: 'Email Code',
              publicName: 'Login with Email Code',
              emailSlug: `${slugify(d.consumerSurface.name)}-${generatePlainId(8)}`,
              consumerSurfaceOid: d.consumerSurface.oid
            },
            include
          });
        }
      } else if (d.input.type === 'sso') {
        let existingFactor = await db.consumerSurfaceAuthFactor.findFirst({
          where: {
            consumerSurfaceOid: d.consumerSurface.oid,
            ssoTenant: {
              id: d.input.ssoTenantId
            }
          }
        });
        if (existingFactor && existingFactor.status === 'active') {
          throw new ServiceError(
            badRequestError({
              message: 'SSO auth factor already exists for this consumer surface.'
            })
          );
        }

        if (existingFactor && existingFactor.status !== 'active') {
          return await db.consumerSurfaceAuthFactor.update({
            where: { oid: existingFactor.oid },
            data: { status: 'active' },
            include
          });
        } else {
          let ssoTenant = await db.ssoTenant.findFirst({
            where: {
              id: d.input.ssoTenantId,
              organizationOid: d.consumerSurface.organizationOid
            }
          });
          if (!ssoTenant) {
            throw new ServiceError(notFoundError('sso.tenant'));
          }

          return await db.consumerSurfaceAuthFactor.create({
            data: {
              id: await ID.generateId('consumerSurfaceAuthFactor'),
              type: 'sso',
              status: 'active',
              name: `SSO (${ssoTenant.name})`,
              publicName: `Login with ${ssoTenant.name}`,
              ssoTenantOid: ssoTenant.oid,
              consumerSurfaceOid: d.consumerSurface.oid
            },
            include
          });
        }
      } else {
        throw new ServiceError(
          badRequestError({
            message: 'Invalid auth factor type.'
          })
        );
      }
    });
  }

  async deleteConsumerAuthFactor(d: { consumerAuthFactor: ConsumerSurfaceAuthFactor }) {
    if (d.consumerAuthFactor.status !== 'active') {
      throw new ServiceError(
        badRequestError({
          message: 'Consumer auth factor is already inactive.'
        })
      );
    }

    return await db.consumerSurfaceAuthFactor.update({
      where: { oid: d.consumerAuthFactor.oid },
      data: { status: 'inactive' },
      include
    });
  }

  async updateConsumerAuthFactor(d: {
    consumerAuthFactor: ConsumerSurfaceAuthFactor;
    input: {
      name?: string;
      publicName?: string;
    };
  }) {
    if (d.consumerAuthFactor.status !== 'active') {
      throw new ServiceError(
        badRequestError({
          message: 'Cannot update an inactive consumer auth factor.'
        })
      );
    }

    return await db.consumerSurfaceAuthFactor.update({
      where: { oid: d.consumerAuthFactor.oid },
      data: {
        name: d.input.name,
        publicName: d.input.publicName
      },
      include
    });
  }
}

export let consumerAuthFactorService = Service.create(
  'consumerAuthFactorService',
  () => new consumerAuthFactorServiceImpl()
).build();
