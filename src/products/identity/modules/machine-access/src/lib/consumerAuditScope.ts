import { type AuditScope, createAuditScope } from '@metorial/audit-scope';
import { Context } from '@metorial/context';
import { ConsumerProfile } from '@metorial/db';

export let createConsumerProfileAuditScope = (d: {
  consumerProfile: Pick<
    ConsumerProfile,
    'id' | 'organizationOid' | 'instanceOid' | 'organizationActorOid'
  >;
  context: Context;
}): AuditScope =>
  createAuditScope({
    organization: { oid: d.consumerProfile.organizationOid },
    instance: { oid: d.consumerProfile.instanceOid },
    organizationActor: { oid: d.consumerProfile.organizationActorOid },
    actor: { type: 'consumer_profile', id: d.consumerProfile.id },
    context: d.context
  });
