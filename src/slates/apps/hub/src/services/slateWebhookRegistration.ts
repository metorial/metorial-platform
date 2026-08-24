import { generateCustomId } from '@lowerdeck/id';
import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { SlateWebhookRegistrationType, Tenant } from '../../prisma/generated/client';
import { db } from '../db';
import { env } from '../env';

let include = {
  instance: true,
  instanceConfig: true,
  authConfig: true
};

let getRegion = () => {
  let region =
    env.service.METORIAL_REGION ?? (env.service.METORIAL_ENV !== 'production' ? 'dev' : undefined);
  if (!region) throw new Error('METORIAL_REGION is required to generate webhook registrations');
  if (!/^[a-z0-9-]+$/.test(region)) throw new Error(`Invalid METORIAL_REGION: ${region}`);
  return region;
};

// Regionalized so a global webhook receiver can route the request to the
// correct region purely from the urlKey suffix.
export let generateWebhookRegistrationUrlKey = () => `${generateCustomId('whk_')}_${getRegion()}`;

class slateWebhookRegistrationServiceImpl {
  async getWebhookRegistrationById(d: {
    tenant: Tenant;
    id: string;
    type?: SlateWebhookRegistrationType;
  }) {
    let registration = await db.slateWebhookRegistration.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        id: d.id,
        status: 'active',
        type: d.type
      },
      include
    });
    if (!registration) throw new ServiceError(notFoundError('slate.webhook_registration'));
    return registration;
  }

  async getWebhookRegistrationByUrlKey(d: { urlKey: string }) {
    let registration = await db.slateWebhookRegistration.findUnique({
      where: { urlKey: d.urlKey },
      include
    });
    if (!registration) throw new ServiceError(notFoundError('slate.webhook_registration'));
    return registration;
  }

  async listWebhookRegistrations(d: {
    tenant: Tenant;
    slateInstanceIds?: string[];
    type?: SlateWebhookRegistrationType;
  }) {
    let slateInstances = d.slateInstanceIds
      ? await db.slateInstance.findMany({
          where: { id: { in: d.slateInstanceIds }, tenantOid: d.tenant.oid }
        })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.slateWebhookRegistration.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              status: 'active',
              type: d.type,
              instanceOid: slateInstances ? { in: slateInstances.map(si => si.oid) } : undefined
            },
            include
          })
      )
    );
  }

  async updateWebhookRegistration(d: {
    tenant: Tenant;
    registration: { oid: bigint; tenantOid: bigint };
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
    };
  }) {
    if (d.registration.tenantOid !== d.tenant.oid) {
      throw new ServiceError(notFoundError('slate.webhook_registration'));
    }

    return db.slateWebhookRegistration.update({
      where: { oid: d.registration.oid },
      data: {
        name: d.input.name,
        description: d.input.description,
        metadata: d.input.metadata
      },
      include
    });
  }

  async deleteWebhookRegistration(d: {
    tenant: Tenant;
    registration: { oid: bigint; tenantOid: bigint };
  }) {
    if (d.registration.tenantOid !== d.tenant.oid) {
      throw new ServiceError(notFoundError('slate.webhook_registration'));
    }

    await db.slateWebhookRegistration.update({
      where: { oid: d.registration.oid },
      data: { status: 'deleted' }
    });
  }
}

export let slateWebhookRegistrationService = Service.create(
  'slateWebhookRegistrationService',
  () => new slateWebhookRegistrationServiceImpl()
).build();
