import { type Instance, type Organization } from '@metorial/db';
import { type AssistantActorInput } from '../synthesis';

export let assertAssistantScope = (
  d: {
    organization: Organization;
    instance: Instance;
  } & AssistantActorInput
) => {
  if (d.instance.organizationOid !== d.organization.oid) {
    throw new Error('Assistant scope is invalid');
  }

  if (d.actor && d.actor.organizationOid !== d.organization.oid) {
    throw new Error('Assistant scope is invalid');
  }
};
