import { randomBytes } from 'crypto';
import type {
  PrismaClient,
  SlateTriggerEvent,
  SlateTriggerReceiver,
  SlateTriggerReceiverTrigger,
  SlateAction,
  Slate,
  SlateInstance,
  SlateVersion,
  SlateSpecification,
  SlateInvocation,
  Tenant
} from '../../../prisma/generated/client';
import { SlateTriggerEventDeliveryStatus } from '../../../prisma/generated/client';
import { getId } from '../../id';
import { defineFactory } from '@mtsrc/testing-tools';
import { SlateTriggerReceiverFixtures } from './slateTriggerReceiverFixtures';
import { SlateInvocationFixtures, SlateInvocationStorageBucketFixtures } from './invocationFixtures';
import { DeploymentProviderFixtures, SlateDeploymentFixtures } from './deploymentFixtures';

export const SlateTriggerEventFixtures = (db: PrismaClient) => {
  const defaultEvent = async (data: {
    receiverOid: bigint;
    receiverTriggerOid: bigint;
    actionOid: bigint;
    slateOid: bigint;
    instanceOid: bigint;
    invocationOid: bigint;
    overrides?: Partial<SlateTriggerEvent>;
  }): Promise<SlateTriggerEvent> => {
    const { oid, id } = getId('slateTriggerEvent');
    const sourceId = `event_${randomBytes(8).toString('hex')}`;

    const factory = defineFactory<SlateTriggerEvent>(
      {
        oid,
        id,
        receiverOid: data.receiverOid,
        receiverTriggerOid: data.receiverTriggerOid,
        actionOid: data.actionOid,
        slateOid: data.slateOid,
        slateInstanceOid: data.instanceOid,
        invocationOid: data.invocationOid,
        type: 'test.event',
        sourceId,
        input: { test: 'input' },
        output: { test: 'output' },
        deliveryStatus: SlateTriggerEventDeliveryStatus.pending,
        signalEventId: `signal_${randomBytes(8).toString('hex')}`,
        ...data.overrides
      } as SlateTriggerEvent,
      {
        persist: value => db.slateTriggerEvent.create({ data: value })
      }
    );

    return factory.create(data.overrides ?? {});
  };

  const completeForReceiver = async (data: {
    receiverOid: bigint;
    receiverTriggerOid: bigint;
    actionOid: bigint;
    tenantOid: bigint;
    eventOverrides?: Partial<SlateTriggerEvent>;
  }): Promise<{
    event: SlateTriggerEvent;
    slate: Slate & { currentVersion: SlateVersion & { specification: SlateSpecification } };
    instance: SlateInstance;
    invocation: SlateInvocation;
  }> => {
    const { SlateFixtures } = await import('./slateFixtures');
    const { SlateInstanceFixtures } = await import('./instanceFixtures');

    const providerFixtures = DeploymentProviderFixtures(db);
    const provider = await providerFixtures.default();

    const slateFixtures = SlateFixtures(db);
    const slate = await slateFixtures.complete();

    const deploymentFixtures = SlateDeploymentFixtures(db);
    const deployment = await deploymentFixtures.default({
      slateOid: slate.oid,
      slateVersionOid: slate.currentVersion.oid,
      providerOid: provider.oid
    });

    const bucketFixtures = SlateInvocationStorageBucketFixtures(db);
    const bucket = await bucketFixtures.default();

    const instanceFixtures = SlateInstanceFixtures(db);
    const instance = await instanceFixtures.default({
      slateOid: slate.oid,
      tenantOid: data.tenantOid
    });

    const invocationFixtures = SlateInvocationFixtures(db);
    const invocation = await invocationFixtures.default({
      deploymentOid: deployment.oid,
      bucketOid: bucket.oid
    });

    const event = await defaultEvent({
      receiverOid: data.receiverOid,
      receiverTriggerOid: data.receiverTriggerOid,
      actionOid: data.actionOid,
      slateOid: slate.oid,
      instanceOid: instance.oid,
      invocationOid: invocation.oid,
      overrides: data.eventOverrides
    });

    return { event, slate, instance, invocation };
  };

  const complete = async (data?: {
    eventOverrides?: Partial<SlateTriggerEvent>;
  }): Promise<{
    event: SlateTriggerEvent;
    receiver: SlateTriggerReceiver;
    receiverTrigger: SlateTriggerReceiverTrigger;
    triggerAction: SlateAction;
    slate: Slate & { currentVersion: SlateVersion & { specification: SlateSpecification } };
    instance: SlateInstance;
    invocation: SlateInvocation;
    tenant: Tenant;
  }> => {
    const receiverFixtures = SlateTriggerReceiverFixtures(db);
    const { receiver, receiverTrigger, triggerAction, slate, instance, tenant } =
      await receiverFixtures.complete();

    const providerFixtures = DeploymentProviderFixtures(db);
    const provider = await providerFixtures.default();

    const deploymentFixtures = SlateDeploymentFixtures(db);
    const deployment = await deploymentFixtures.default({
      slateOid: slate.oid,
      slateVersionOid: slate.currentVersion.oid,
      providerOid: provider.oid
    });

    const bucketFixtures = SlateInvocationStorageBucketFixtures(db);
    const bucket = await bucketFixtures.default();

    const invocationFixtures = SlateInvocationFixtures(db);
    const invocation = await invocationFixtures.default({
      deploymentOid: deployment.oid,
      bucketOid: bucket.oid
    });

    const event = await defaultEvent({
      receiverOid: receiver.oid,
      receiverTriggerOid: receiverTrigger.oid,
      actionOid: triggerAction.oid,
      slateOid: slate.oid,
      instanceOid: instance.oid,
      invocationOid: invocation.oid,
      overrides: data?.eventOverrides
    });

    return {
      event,
      receiver,
      receiverTrigger,
      triggerAction,
      slate,
      instance,
      invocation,
      tenant
    };
  };

  return {
    default: defaultEvent,
    completeForReceiver,
    complete
  };
};
