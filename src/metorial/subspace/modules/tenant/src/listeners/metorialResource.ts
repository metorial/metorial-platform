import { addAfterTransactionHook } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import {
  deleteMetorialConsumerQueue,
  syncMetorialConsumerProfileQueue,
  syncMetorialConsumerQueue,
  syncMetorialInstanceQueue,
  syncMetorialOrganizationQueue,
  syncMetorialOrganizationActorQueue,
  syncMetorialOrganizationMemberQueue,
  syncMetorialProjectQueue
} from '../queues/metorialResource';

export let syncOrganizationResource = async (d: { organization: { id: string } }) => {
  await addAfterTransactionHook(() =>
    syncMetorialOrganizationQueue.add({ organizationId: d.organization.id })
  );
};

export let syncProjectResource = async (d: { project: { id: string } }) => {
  await addAfterTransactionHook(() =>
    syncMetorialProjectQueue.add({ projectId: d.project.id })
  );
};

export let syncInstanceResource = async (d: { instance: { id: string } }) => {
  await addAfterTransactionHook(() =>
    syncMetorialInstanceQueue.add({ instanceId: d.instance.id })
  );
};

export let syncOrganizationActorResource = async (d: { actor: { id: string } }) => {
  await addAfterTransactionHook(() =>
    syncMetorialOrganizationActorQueue.add({ organizationActorId: d.actor.id })
  );
};

export let syncOrganizationMemberResource = async (d: { member: { id: string } }) => {
  await addAfterTransactionHook(() =>
    syncMetorialOrganizationMemberQueue.add({ organizationMemberId: d.member.id })
  );
};

export let syncConsumerResource = async (d: { consumer: { id: string } }) => {
  await addAfterTransactionHook(() =>
    syncMetorialConsumerQueue.add({ consumerId: d.consumer.id })
  );
};

export let deleteConsumerResource = async (d: { consumerId: string }) => {
  await addAfterTransactionHook(() =>
    deleteMetorialConsumerQueue.add({ consumerId: d.consumerId })
  );
};

export let syncConsumerProfileResource = async (d: { consumerProfile: { id: string } }) => {
  await addAfterTransactionHook(() =>
    syncMetorialConsumerProfileQueue.add({ consumerProfileId: d.consumerProfile.id })
  );
};

Fabric.listen('organization.created:after', syncOrganizationResource);
Fabric.listen('organization.updated:after', syncOrganizationResource);
Fabric.listen('organization.project.created:after', syncProjectResource);
Fabric.listen('organization.project.updated:after', syncProjectResource);
Fabric.listen('organization.project.instance.created:after', syncInstanceResource);
Fabric.listen('organization.project.instance.updated:after', syncInstanceResource);
Fabric.listen('organization.actor.created:after', syncOrganizationActorResource);
Fabric.listen('organization.actor.updated:after', syncOrganizationActorResource);
Fabric.listen('organization.member.created:after', syncOrganizationMemberResource);
Fabric.listen('organization.member.updated:after', syncOrganizationMemberResource);
Fabric.listen('organization.member.deleted:after', syncOrganizationMemberResource);
Fabric.listen('consumer.created:after', syncConsumerResource);
Fabric.listen('consumer.updated:after', syncConsumerResource);
Fabric.listen('consumer.deleted:after', deleteConsumerResource);
Fabric.listen('consumer.profile.created:after', syncConsumerProfileResource);
Fabric.listen('consumer.profile.updated:after', syncConsumerProfileResource);
Fabric.listen('consumer.profile.deleted:after', syncConsumerProfileResource);
