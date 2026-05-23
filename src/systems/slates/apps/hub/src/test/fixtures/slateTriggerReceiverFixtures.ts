import { randomBytes } from 'crypto';
import type {
  PrismaClient,
  SlateTriggerReceiver,
  SlateTriggerReceiverTrigger,
  Slate,
  SlateInstance,
  SlateVersion,
  SlateSpecification,
  SlateAction,
  Tenant
} from '../../../prisma/generated/client';
import {
  SlateTriggerReceiverStatus,
  SlateTriggerReceiverTriggerSource,
  SlateStatus
} from '../../../prisma/generated/client';
import { getId } from '../../id';
import { defineFactory } from '@mtsrc/testing-tools';
import { TenantFixtures } from './tenantFixtures';
import { SlateFixtures } from './slateFixtures';
import { SlateInstanceFixtures } from './instanceFixtures';
import { SlateSpecificationFixtures } from './slateSpecificationFixtures';

export const SlateTriggerReceiverFixtures = (db: PrismaClient) => {
  const defaultReceiver = async (data: {
    tenantOid: bigint;
    slateOid: bigint;
    instanceOid: bigint;
    overrides?: Partial<SlateTriggerReceiver>;
  }): Promise<SlateTriggerReceiver> => {
    const { oid, id } = getId('slateTriggerReceiver');

    const factory = defineFactory<SlateTriggerReceiver>(
      {
        oid,
        id,
        tenantOid: data.tenantOid,
        slateOid: data.slateOid,
        slateInstanceOid: data.instanceOid,
        status: SlateTriggerReceiverStatus.active,
        name: `receiver-${randomBytes(4).toString('hex')}`,
        eventTypes: ['*'],
        ...data.overrides
      } as SlateTriggerReceiver,
      {
        persist: value => db.slateTriggerReceiver.create({ data: value })
      }
    );

    return factory.create(data.overrides ?? {});
  };

  const createTrigger = async (data: {
    receiverOid: bigint;
    actionOid: bigint;
    source?: SlateTriggerReceiverTriggerSource;
    overrides?: Partial<SlateTriggerReceiverTrigger>;
  }): Promise<SlateTriggerReceiverTrigger> => {
    const { oid, id } = getId('slateTriggerReceiverTrigger');
    const source = data.source ?? SlateTriggerReceiverTriggerSource.polling;

    const factory = defineFactory<SlateTriggerReceiverTrigger>(
      {
        oid,
        id,
        receiverOid: data.receiverOid,
        actionOid: data.actionOid,
        source,
        pollIntervalSeconds:
          data.source === SlateTriggerReceiverTriggerSource.polling ? 60 : null,
        state: {},
        registrationDetails: {},
        ...data.overrides
      } as SlateTriggerReceiverTrigger,
      {
        persist: value => db.slateTriggerReceiverTrigger.create({ data: value })
      }
    );

    return factory.create(data.overrides ?? {});
  };

  const withInstance = async (data: {
    tenantOid: bigint;
    slateOid: bigint;
  }): Promise<SlateTriggerReceiver> => {
    const instanceFixtures = SlateInstanceFixtures(db);
    const instance = await instanceFixtures.default({
      slateOid: data.slateOid,
      tenantOid: data.tenantOid
    });
    return defaultReceiver({
      tenantOid: data.tenantOid,
      slateOid: data.slateOid,
      instanceOid: instance.oid
    });
  };

  const complete = async (data?: {
    slateIdentifier?: string;
    slateStatus?: SlateStatus;
    receiverOverrides?: Partial<SlateTriggerReceiver>;
  }): Promise<{
    receiver: SlateTriggerReceiver;
    receiverTrigger: SlateTriggerReceiverTrigger;
    triggerAction: SlateAction;
    slate: Slate & { currentVersion: SlateVersion & { specification: SlateSpecification } };
    instance: SlateInstance;
    tenant: Tenant;
  }> => {
    const tenantFixtures = TenantFixtures(db);
    const tenant = await tenantFixtures.default();

    const slateFixtures = SlateFixtures(db);
    const slate = await slateFixtures.complete({
      slateIdentifier: data?.slateIdentifier,
      slateStatus: data?.slateStatus ?? SlateStatus.active
    });

    const instanceFixtures = SlateInstanceFixtures(db);
    const instance = await instanceFixtures.default({
      slateOid: slate.oid,
      tenantOid: tenant.oid
    });

    const specFixtures = SlateSpecificationFixtures(db);
    const triggerAction = await specFixtures.withTriggerAction({
      slateOid: slate.oid,
      specificationOid: slate.currentVersion.specification.oid
    });

    const receiver = await defaultReceiver({
      tenantOid: tenant.oid,
      slateOid: slate.oid,
      instanceOid: instance.oid,
      overrides: data?.receiverOverrides
    });

    const receiverTrigger = await createTrigger({
      receiverOid: receiver.oid,
      actionOid: triggerAction.oid
    });

    return { receiver, receiverTrigger, triggerAction, slate, instance, tenant };
  };

  return {
    default: defaultReceiver,
    createTrigger,
    withInstance,
    complete
  };
};
