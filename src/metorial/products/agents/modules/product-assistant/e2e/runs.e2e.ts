import { expectServiceError, firstPage, uniqueId, useOrganization } from '@metorial/e2e';
import { db } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import {
  productAssistantMessageService,
  productAssistantRequestService,
  type AgentRunWireMessage,
  type State
} from '../src';
import { createClientReplica, type JsonValue } from '../src/lib/delta';
import { getConversationHistory } from '../src/lib/history/getHistory';
import { reducedSubprocessorsErrorMessage } from '../src/lib/reducedSubprocessors';
import {
  assistantText,
  conversationItems,
  createConversation,
  defaultModelSlug,
  e2eModelDirectives,
  e2eModelFailureMessage,
  e2eModelUsage,
  e2eToolOutput,
  echoReply,
  getTestAssistant,
  loadAssistantFixture,
  runTestTimeoutMs,
  runTimeoutMs,
  sendAndSettle,
  sendMessage,
  serializedRoles,
  waitForSettledRequest
} from './_fixtures';

describe('module-product-assistant: runs', () => {
  let org = useOrganization();

  it(
    'runs a user message and persists the assistant reply, run and cost',
    async () => {
      let fixture = await loadAssistantFixture(org.ids);
      let assistant = await getTestAssistant(fixture);
      let conversation = await createConversation(fixture);
      let text = uniqueId('hello');

      let sent = await sendMessage(fixture, conversation, text);
      expect(sent.request).toMatchObject({
        status: 'pending',
        historySize: 100,
        modelOid: assistant.defaultModel!.oid,
        resourceActorOid: fixture.resourceActor.oid
      });
      expect(sent.userMessage).toMatchObject({
        type: 'user',
        parentMessageOid: conversation.rootMessage.oid,
        requestOid: sent.request.oid,
        modelOid: assistant.defaultModel!.oid
      });
      expect((sent.userMessage.state as unknown as State).items).toMatchObject([
        { type: 'message', status: 'completed', message: { role: 'user', parts: [{ text }] } }
      ]);

      let request = await waitForSettledRequest(sent.request.id);
      expect(request.status).toBe('completed');
      expect(request.runs).toHaveLength(1);

      let run = request.runs[0]!;
      expect(run).toMatchObject({
        status: 'completed',
        modelOid: assistant.defaultModel!.oid,
        conversationOid: conversation.oid,
        cost: {
          inputTokens: e2eModelUsage.inputTokens,
          outputTokens: e2eModelUsage.outputTokens,
          totalTokens: e2eModelUsage.inputTokens + e2eModelUsage.outputTokens
        }
      });
      expect(run.cost.totalCost).toBeCloseTo(run.cost.inputCost + run.cost.outputCost);
      expect(run.metadata.completedAt).toEqual(expect.any(String));
      expect(run.metadata.finalSnapshotIndex).toBeGreaterThan(0);

      let reply = await db.productAssistantMessage.findFirstOrThrow({
        where: { requestOid: request.oid, type: 'assistant' }
      });
      expect(reply).toMatchObject({
        status: 'completed',
        parentMessageOid: sent.userMessage.oid,
        runOid: run.oid,
        modelOid: assistant.defaultModel!.oid
      });
      expect(assistantText(reply.state)).toBe(echoReply(defaultModelSlug, text, [text]));
      expect(serializedRoles(reply.serialized)).toEqual(['user', 'assistant']);

      let userMessage = await db.productAssistantMessage.findUniqueOrThrow({
        where: { oid: sent.userMessage.oid }
      });
      expect(userMessage.runOid).toBe(run.oid);

      let messages = await firstPage(
        await productAssistantMessageService.listAssistantMessages({
          project: fixture.project,
          instance: fixture.instance,
          actor: fixture.resourceActor,
          conversation
        })
      );
      expect(messages.map(item => item.message.id)).toEqual([
        conversation.rootMessage.id,
        sent.userMessage.id,
        reply.id
      ]);

      let fetched = await productAssistantMessageService.getAssistantMessageById({
        project: fixture.project,
        instance: fixture.instance,
        actor: fixture.resourceActor,
        conversation,
        messageId: reply.id
      });
      expect(fetched.message).toMatchObject({
        type: 'assistant',
        request: { id: request.id, status: 'completed' },
        run: { id: run.id, status: 'completed' },
        model: { slug: defaultModelSlug }
      });
    },
    runTestTimeoutMs
  );

  it(
    'assembles history along the parent chain, in order and without duplicates',
    async () => {
      let fixture = await loadAssistantFixture(org.ids);
      let conversation = await createConversation(fixture);
      let [t1, t2, t3, branch, fresh] = ['one', 'two', 'three', 'branch', 'fresh'].map(
        prefix => uniqueId(prefix)
      ) as [string, string, string, string, string];

      let first = await sendAndSettle(fixture, conversation, t1);
      let second = await sendAndSettle(fixture, conversation, t2);
      let third = await sendAndSettle(fixture, conversation, t3);

      expect(assistantText(first.reply?.state)).toBe(echoReply(defaultModelSlug, t1, [t1]));
      expect(assistantText(second.reply?.state)).toBe(
        echoReply(defaultModelSlug, t2, [t1, t2])
      );
      expect(assistantText(third.reply?.state)).toBe(
        echoReply(defaultModelSlug, t3, [t1, t2, t3])
      );
      expect(second.userMessage.parentMessageOid).toBe(first.reply!.oid);
      expect(third.userMessage.parentMessageOid).toBe(second.reply!.oid);

      let history = await getConversationHistory({
        conversation,
        lastMessageId: third.reply!.id,
        size: 100
      });
      expect(history.map(message => message.id)).toEqual([
        conversation.rootMessage.id,
        first.userMessage.id,
        first.reply!.id,
        second.userMessage.id,
        second.reply!.id,
        third.userMessage.id,
        third.reply!.id
      ]);

      let tail = await getConversationHistory({
        conversation,
        lastMessageId: third.reply!.id,
        size: 2
      });
      expect(tail.map(message => message.id)).toEqual([third.userMessage.id, third.reply!.id]);

      let branched = await sendAndSettle(fixture, conversation, branch, {
        parentMessageId: first.reply!.id
      });
      expect(branched.userMessage.parentMessageOid).toBe(first.reply!.oid);
      expect(assistantText(branched.reply?.state)).toBe(
        echoReply(defaultModelSlug, branch, [t1, branch])
      );

      let restarted = await sendAndSettle(fixture, conversation, fresh, {
        parentMessageId: conversation.rootMessage.id
      });
      expect(assistantText(restarted.reply?.state)).toBe(
        echoReply(defaultModelSlug, fresh, [fresh])
      );

      let branchHistory = await getConversationHistory({
        conversation,
        lastMessageId: branched.reply!.id,
        size: 100
      });
      expect(branchHistory.map(message => message.id)).toEqual([
        conversation.rootMessage.id,
        first.userMessage.id,
        first.reply!.id,
        branched.userMessage.id,
        branched.reply!.id
      ]);
    },
    runTestTimeoutMs
  );

  it(
    'runs a request on an explicitly chosen model',
    async () => {
      let fixture = await loadAssistantFixture(org.ids);
      let assistant = await getTestAssistant(fixture);
      let haiku = assistant.availableModels.find(model => model.slug == 'claude-haiku-4-5')!;
      let conversation = await createConversation(fixture);
      let text = uniqueId('haiku');

      let sent = await sendAndSettle(fixture, conversation, text, { modelId: haiku.id });
      expect(sent.request).toMatchObject({ status: 'completed', modelOid: haiku.oid });
      expect(sent.request.runs[0]!.modelOid).toBe(haiku.oid);
      expect(sent.reply!.modelOid).toBe(haiku.oid);
      expect(assistantText(sent.reply!.state)).toBe(echoReply(haiku.slug, text, [text]));

      let bySlug = await sendMessage(fixture, conversation, uniqueId('by-slug'), {
        modelId: haiku.slug
      });
      expect(bySlug.request.modelOid).toBe(haiku.oid);
      await waitForSettledRequest(bySlug.request.id);
    },
    runTestTimeoutMs
  );

  it('rejects unknown models and parent messages without writing anything', async () => {
    let fixture = await loadAssistantFixture(org.ids);
    let conversation = await createConversation(fixture);
    let otherConversation = await createConversation(fixture);

    await expectServiceError(
      sendMessage(fixture, conversation, uniqueId('text'), { modelId: uniqueId('model') }),
      'not_found'
    );
    await expectServiceError(
      sendMessage(fixture, conversation, uniqueId('text'), {
        parentMessageId: uniqueId('message')
      }),
      'not_found'
    );
    await expectServiceError(
      sendMessage(fixture, conversation, uniqueId('text'), {
        parentMessageId: otherConversation.rootMessage.id
      }),
      'not_found'
    );

    expect(await conversationItems(conversation)).toHaveLength(1);
    expect(
      await db.productAssistantRequest.count({ where: { conversationOid: conversation.oid } })
    ).toBe(1);
  });

  it(
    'executes tool calls inside a run and keeps them in the history',
    async () => {
      let fixture = await loadAssistantFixture(org.ids);
      let conversation = await createConversation(fixture);
      let text = `${e2eModelDirectives.tool} ${uniqueId('tool')}`;

      let sent = await sendAndSettle(fixture, conversation, text);
      expect(sent.request.status).toBe('completed');

      let items = (sent.reply!.state as unknown as State).items;
      let shellIndex = items.findIndex(item => item.type == 'shell');
      let messageIndex = items.findIndex(item => item.type == 'message');
      expect(items[shellIndex]).toMatchObject({
        type: 'shell',
        status: 'completed',
        command: `echo ${e2eToolOutput}`,
        stdout: `${e2eToolOutput}\n`,
        exitCode: 0
      });
      expect(messageIndex).toBeGreaterThan(shellIndex);
      expect(assistantText(sent.reply!.state)).toBe(`Tool finished: ${e2eToolOutput}`);
      expect(serializedRoles(sent.reply!.serialized)).toEqual([
        'user',
        'assistant',
        'tool',
        'assistant'
      ]);

      expect(sent.request.runs[0]!.cost).toMatchObject({
        inputTokens: 2 * e2eModelUsage.inputTokens,
        outputTokens: 2 * e2eModelUsage.outputTokens
      });

      let followUp = uniqueId('after-tool');
      let next = await sendAndSettle(fixture, conversation, followUp);
      expect(assistantText(next.reply!.state)).toBe(
        echoReply(defaultModelSlug, followUp, [text, followUp])
      );
    },
    runTestTimeoutMs
  );

  it(
    'fails the request when the model throws, and recovers on the next message',
    async () => {
      let fixture = await loadAssistantFixture(org.ids);
      let conversation = await createConversation(fixture);
      let text = `${e2eModelDirectives.error} ${uniqueId('boom')}`;

      let failed = await sendAndSettle(fixture, conversation, text);
      expect(failed.request.status).toBe('failed');
      expect(failed.reply).toBeNull();
      expect(failed.request.runs).toHaveLength(1);
      expect(failed.request.runs[0]).toMatchObject({
        status: 'failed',
        cost: { inputTokens: 0, outputTokens: 0, totalCost: 0 },
        metadata: { error: { message: e2eModelFailureMessage } }
      });
      expect(failed.request.runs[0]!.metadata.failedAt).toEqual(expect.any(String));

      let items = await conversationItems(conversation);
      expect(items.map(item => item.message.type)).toEqual(['root', 'user']);

      let retryText = uniqueId('retry');
      let recovered = await sendAndSettle(fixture, conversation, retryText);
      expect(recovered.request.status).toBe('completed');
      expect(recovered.userMessage.parentMessageOid).toBe(failed.userMessage.oid);
      expect(assistantText(recovered.reply!.state)).toBe(
        echoReply(defaultModelSlug, retryText, [text, retryText])
      );
    },
    runTestTimeoutMs
  );

  it(
    'streams deltas that reduce to the persisted reply',
    async () => {
      let fixture = await loadAssistantFixture(org.ids);
      let conversation = await createConversation(fixture);
      let text = `${e2eModelDirectives.slow} ${uniqueId('stream')}`;

      let sent = await sendMessage(fixture, conversation, text);

      let snapshots = 0;
      let deltas = 0;
      let gaps: unknown[] = [];
      let observedTexts = new Set<string>();
      let replica = createClientReplica<JsonValue>({
        onSnapshotRequired: (reason, meta) => gaps.push({ reason: String(reason), ...meta })
      });

      let done = await new Promise<{ status: string }>((resolve, reject) => {
        productAssistantRequestService
          .listenToAssistantRequestDeltas({
            requestId: sent.request.id,
            runWaitTimeoutMs: runTimeoutMs,
            onMessage: (message: AgentRunWireMessage) => {
              if (message[0] == 's') snapshots++;
              else deltas++;

              replica.receive(message);
              observedTexts.add(assistantText(replica.getState()));
            },
            onError: reject,
            onDone: resolve
          })
          .catch(reject);
      });
      expect(done.status).toBe('completed');

      let request = await waitForSettledRequest(sent.request.id);
      let reply = await db.productAssistantMessage.findFirstOrThrow({
        where: { requestOid: request.oid, type: 'assistant' }
      });

      expect(gaps).toEqual([]);
      expect(snapshots).toBeGreaterThan(0);
      expect(deltas).toBeGreaterThan(0);
      expect(observedTexts.size).toBeGreaterThan(2);
      expect(replica.getState()).toEqual(reply.state);
      expect(assistantText(replica.getState())).toBe(
        echoReply(defaultModelSlug, text, [text])
      );
    },
    runTestTimeoutMs
  );

  it(
    'replays the persisted state to a listener that joins after the run finished',
    async () => {
      let fixture = await loadAssistantFixture(org.ids);
      let conversation = await createConversation(fixture);
      let text = uniqueId('late');

      let sent = await sendAndSettle(fixture, conversation, text);
      let replica = createClientReplica<JsonValue>();

      let done = await new Promise<{ status: string }>((resolve, reject) => {
        productAssistantRequestService
          .listenToAssistantRequestDeltas({
            requestId: sent.request.id,
            onMessage: message => replica.receive(message),
            onError: reject,
            onDone: resolve
          })
          .catch(reject);
      });

      expect(done.status).toBe('completed');
      expect(replica.getState()).toEqual(sent.reply!.state);
    },
    runTestTimeoutMs
  );
});

describe('module-product-assistant: runs with reduced subprocessors', () => {
  let org = useOrganization();

  it(
    'blocks new requests and fails queued runs once AI subprocessors are restricted',
    async () => {
      let fixture = await loadAssistantFixture(org.ids);
      let conversation = await createConversation(fixture);

      let restricted = await expectServiceError(
        productAssistantRequestService.createAssistantRequest({
          project: { ...fixture.project, reducedSubprocessors: true },
          instance: fixture.instance,
          actor: fixture.resourceActor,
          conversation,
          input: { message: { parts: [{ type: 'text', text: uniqueId('blocked') }] } }
        }),
        'forbidden'
      );
      expect(restricted.message).toBe(reducedSubprocessorsErrorMessage);
      expect(await conversationItems(conversation)).toHaveLength(1);

      await db.project.update({
        where: { oid: fixture.project.oid },
        data: { reducedSubprocessors: true }
      });

      let queued = await sendAndSettle(fixture, conversation, uniqueId('queued'));
      expect(queued.request.status).toBe('failed');
      expect(queued.reply).toBeNull();
      expect(queued.request.runs[0]).toMatchObject({
        status: 'failed',
        metadata: { error: { message: reducedSubprocessorsErrorMessage } }
      });
    },
    runTestTimeoutMs
  );
});
