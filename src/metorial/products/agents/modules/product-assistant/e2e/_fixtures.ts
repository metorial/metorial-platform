import { eventually, uniqueId } from '@metorial/e2e';
import { db, loadOrganizationFixture } from '@metorial/e2e/db';
import type { ProductAssistantConversation, ResourceActor } from '@metorial/db';
import { resourceActorService } from '@metorial/module-resource-actor';
import {
  productAssistantConversationService,
  productAssistantRequestService,
  productAssistantService,
  type State
} from '../src';

export {
  e2eModelDirectives,
  e2eModelFailureMessage,
  e2eModelUsage,
  e2eToolOutput
} from '../src/lib/definitions/e2eModel';

export let runTimeoutMs = 60_000;
export let runTestTimeoutMs = 180_000;
export let defaultModelSlug = 'claude-sonnet-4-6';

export type AssistantFixture = Awaited<ReturnType<typeof loadAssistantFixture>>;

export let loadAssistantFixture = async (
  ids: Parameters<typeof loadOrganizationFixture>[0]
) => {
  let fixture = await loadOrganizationFixture(ids);
  let actor = await resourceActorService.getOrEnsureOrganizationActor({
    project: fixture.project,
    organizationActor: fixture.actor
  });

  return { ...fixture, resourceActor: actor };
};

export let createOutsider = async (fixture: AssistantFixture) =>
  await resourceActorService.upsertActor({
    project: fixture.project,
    input: { identifier: uniqueId('e2e-outsider'), name: 'E2E Outsider' }
  });

export let getTestAssistant = async (fixture: AssistantFixture) =>
  await productAssistantService.get({ project: fixture.project, assistantId: 'test' });

export let createConversation = async (
  fixture: AssistantFixture,
  input: { title?: string | null; actor?: ResourceActor } = {}
) =>
  await productAssistantConversationService.createAssistantConversation({
    project: fixture.project,
    instance: fixture.instance,
    actor: input.actor ?? fixture.resourceActor,
    input: { assistantId: 'test', title: input.title }
  });

export let sendMessage = async (
  fixture: AssistantFixture,
  conversation: ProductAssistantConversation,
  text: string,
  input: {
    parentMessageId?: string;
    modelId?: string;
    actor?: ResourceActor;
    allowAllActors?: boolean;
  } = {}
) =>
  await productAssistantRequestService.createAssistantRequest({
    project: fixture.project,
    instance: fixture.instance,
    actor: input.actor ?? fixture.resourceActor,
    conversation,
    input: {
      message: { parts: [{ type: 'text', text }] },
      parentMessageId: input.parentMessageId,
      modelId: input.modelId,
      allowAllActors: input.allowAllActors
    }
  });

export let waitForSettledRequest = async (requestId: string) =>
  await eventually(
    async () => {
      let request = await db.productAssistantRequest.findUniqueOrThrow({
        where: { id: requestId },
        include: { runs: true }
      });
      if (request.status == 'pending')
        throw new Error(`Request ${requestId} is still pending`);

      return request;
    },
    { timeoutMs: runTimeoutMs, intervalMs: 250 }
  );

export let sendAndSettle = async (
  fixture: AssistantFixture,
  conversation: ProductAssistantConversation,
  text: string,
  input: Parameters<typeof sendMessage>[3] = {}
) => {
  let sent = await sendMessage(fixture, conversation, text, input);
  let request = await waitForSettledRequest(sent.request.id);
  let reply = await db.productAssistantMessage.findFirst({
    where: { requestOid: request.oid, type: 'assistant' }
  });

  return { ...sent, request, reply };
};

export let echoReply = (modelSlug: string, text: string, history: string[]) =>
  `Echo from ${modelSlug}: ${text}\nHistory: ${history.join(' > ')}`;

export let assistantText = (state: unknown) => {
  let text = '';

  for (let item of (state as State | null)?.items ?? []) {
    if (item.type != 'message' || item.message.role != 'assistant') continue;

    for (let part of item.message.parts) {
      if (part.type == 'text') text += part.text;
    }
  }

  return text;
};

export let serializedRoles = (serialized: unknown) =>
  (serialized as PrismaJson.ProductAssistantMessageSerializedContent).messages.map(
    ([, message]) => (message as { role: string }).role
  );

export let conversationItems = async (conversation: ProductAssistantConversation) =>
  await db.productAssistantConversationItem.findMany({
    where: { conversationOid: conversation.oid },
    include: { message: true },
    orderBy: { oid: 'asc' }
  });
