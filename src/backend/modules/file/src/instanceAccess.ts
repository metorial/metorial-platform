import { Consumer, OrganizationActor, OrganizationMember } from '@metorial/db';

let fullCargoAccessPermissions = ['content_read', 'content_write'] as const;

export type InstanceCargoAccessContext = {
  member?: OrganizationMember & {
    actor: OrganizationActor;
  };
  consumerProfile?: {
    consumer: Consumer;
  };
};

export let getInstanceCargoAccess = (ctx: InstanceCargoAccessContext) => {
  if (ctx.member?.actor) {
    return {
      accessActor: {
        identifier: `mte-oac-${ctx.member.actor.id}`,
        name: ctx.member.actor.name,
        organizationActorId: ctx.member.actor.id
      },
      defaultPermissions: [...fullCargoAccessPermissions],
      overridePermissions: true
    };
  }

  if (ctx.consumerProfile?.consumer) {
    return {
      accessActor: {
        identifier: `mte-con-${ctx.consumerProfile.consumer.id}`,
        name: ctx.consumerProfile.consumer.name,
        consumerId: ctx.consumerProfile.consumer.id
      }
    };
  }

  return {};
};

export let hasInstanceConsumerAccess = (ctx: InstanceCargoAccessContext) =>
  !!ctx.consumerProfile?.consumer && !ctx.member?.actor;
