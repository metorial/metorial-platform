import { randomBytes } from 'crypto';
import type { PrismaClient, SlateTriggerDestination, Tenant } from '../../../prisma/generated/client';
import {
  SlateTriggerDestinationType,
  SlateTriggerDestinationStatus
} from '../../../prisma/generated/client';
import { getId } from '../../id';
import { defineFactory } from '@mtsrc/testing-tools';
import { TenantFixtures } from './tenantFixtures';

export const SlateTriggerDestinationFixtures = (db: PrismaClient) => {
  const defaultDestination = async (data: {
    tenantOid: bigint;
    overrides?: Partial<SlateTriggerDestination>;
  }): Promise<SlateTriggerDestination> => {
    const { oid, id } = getId('slateTriggerDestination');
    const name = `destination-${randomBytes(4).toString('hex')}`;

    const factory = defineFactory<SlateTriggerDestination>(
      {
        oid,
        id,
        tenantOid: data.tenantOid,
        name,
        type: SlateTriggerDestinationType.http_endpoint,
        status: SlateTriggerDestinationStatus.active,
        url: 'https://example.com/webhook',
        method: 'POST',
        eventTypes: ['*'],
        signalDestinationId: `signal_dest_${randomBytes(8).toString('hex')}`,
        ...data.overrides
      } as SlateTriggerDestination,
      {
        persist: value => db.slateTriggerDestination.create({ data: value })
      }
    );

    return factory.create(data.overrides ?? {});
  };

  const withTenant = async (data?: {
    destinationOverrides?: Partial<SlateTriggerDestination>;
  }): Promise<{
    destination: SlateTriggerDestination;
    tenant: Tenant;
  }> => {
    const tenantFixtures = TenantFixtures(db);
    const tenant = await tenantFixtures.default();

    const destination = await defaultDestination({
      tenantOid: tenant.oid,
      overrides: data?.destinationOverrides
    });

    return { destination, tenant };
  };

  return {
    default: defaultDestination,
    withTenant
  };
};
