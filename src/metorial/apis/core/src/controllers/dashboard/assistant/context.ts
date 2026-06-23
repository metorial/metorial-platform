import { forbiddenError, ServiceError } from '@lowerdeck/error';
import { Consumer, OrganizationActor } from '@metorial/db';
import {
  assistantConversationService,
  assistantMessageService
} from '@metorial/module-assistant';
import { requireParam } from '../../../lib/requireParam';
import { instanceGroup } from '../../../middleware/instanceGroup';

let getAssistantActorContext = (ctx: {
  actor?: OrganizationActor;
  consumerProfile?: {
    consumer: Consumer;
  };
}) => {
  if (ctx.consumerProfile?.consumer) {
    return {
      consumer: ctx.consumerProfile.consumer
    } as const;
  }

  if (ctx.actor) {
    return {
      actor: ctx.actor
    } as const;
  }

  throw new ServiceError(
    forbiddenError({
      message: 'Assistant actor context is required',
      description:
        'Assistant endpoints require an authenticated organization actor or consumer.'
    })
  );
};

export let requireAssistantActor = (ctx: {
  actor?: OrganizationActor;
  consumerProfile?: { consumer: Consumer };
}) => getAssistantActorContext(ctx);

export let assistantConversationGroup = instanceGroup.use(async ctx => {
  let assistantConversationId = requireParam(ctx.params, 'assistantConversationId');

  let assistantConversation = await assistantConversationService.get({
    organization: ctx.organization,
    instance: ctx.instance,
    ...requireAssistantActor(ctx),
    conversationId: assistantConversationId
  });

  return { assistantConversation };
});

export let assistantMessageGroup = assistantConversationGroup.use(async ctx => {
  let assistantMessageId = requireParam(ctx.params, 'assistantMessageId');

  let assistantConversationItem = await assistantMessageService.get({
    organization: ctx.organization,
    instance: ctx.instance,
    ...requireAssistantActor(ctx),
    conversationId: ctx.assistantConversation.id,
    messageId: assistantMessageId
  });

  return { assistantConversationItem };
});
