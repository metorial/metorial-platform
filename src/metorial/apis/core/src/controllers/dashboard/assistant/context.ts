import { forbiddenError, ServiceError } from '@lowerdeck/error';
import type { Instance, Project, ResourceActor } from '@metorial/db';
import {
  productAssistantConversationService,
  productAssistantMessageService,
  type AssistantAccess
} from '@metorial/module-product-assistant';
import {
  getInstanceCargoAccess,
  type InstanceCargoAccessContext
} from '../../../lib/cargoAccess';
import { requireParam } from '../../../lib/requireParam';
import { instanceGroup } from '../../../middleware/instanceGroup';

type AssistantAccessContext = {
  project: Project;
  instance: Instance;
  resourceActor?: ResourceActor;
  consumerProfileFromHeader?: boolean;
};

let requireAssistantActor = (ctx: AssistantAccessContext) => {
  if (ctx.consumerProfileFromHeader) {
    throw new ServiceError(
      forbiddenError({
        message: 'Assistant conversations can only be accessed by their owner',
        description:
          'The metorial-consumer-profile-id header is not supported for assistant endpoints. Authenticate as the consumer instead.'
      })
    );
  }

  if (!ctx.resourceActor) {
    throw new ServiceError(
      forbiddenError({
        message: 'Assistant actor context is required',
        description:
          'Assistant endpoints require an authenticated organization actor or consumer.'
      })
    );
  }

  return ctx.resourceActor;
};

export let getAssistantScope = (ctx: AssistantAccessContext) => ({
  project: ctx.project,
  instance: ctx.instance,
  actor: requireAssistantActor(ctx)
});

export let getAssistantAccess = async (
  ctx: InstanceCargoAccessContext
): Promise<AssistantAccess> => {
  let access = await getInstanceCargoAccess(ctx);

  return {
    authorization: access.authorization,
    auditScope: access.auditScope,
    accessTags: access.accessTags,
    defaultPermissions: access.defaultPermissions,
    overridePermissions: access.overridePermissions
  };
};

export let assistantConversationGroup = instanceGroup.use(async ctx => {
  let assistantConversationId = requireParam(ctx.params, 'assistantConversationId');

  let assistantConversation =
    await productAssistantConversationService.getAssistantConversationById({
      ...getAssistantScope(ctx),
      conversationId: assistantConversationId
    });

  return { assistantConversation };
});

export let assistantMessageGroup = assistantConversationGroup.use(async ctx => {
  let assistantMessageId = requireParam(ctx.params, 'assistantMessageId');

  let assistantConversationItem = await productAssistantMessageService.getAssistantMessageById(
    {
      ...getAssistantScope(ctx),
      conversation: ctx.assistantConversation,
      messageId: assistantMessageId
    }
  );

  return { assistantConversationItem };
});
