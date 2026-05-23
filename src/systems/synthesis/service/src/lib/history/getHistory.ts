import { notFoundError, ServiceError } from '@mtsrc/error';
import type {
  AssistantConversation,
  AssistantMessage,
  Prisma
} from '../../db';
import { db } from '../../db';

let DEFAULT_BLOCK_SIZE = 100;

type ConversationItemWithMessage = Prisma.AssistantConversationItemGetPayload<{
  include: {
    message: true;
  };
}>;

let buildHistory = (d: {
  lastMessage: AssistantMessage;
  messagesByOid: Map<bigint, AssistantMessage>;
}) => {
  let history: AssistantMessage[] = [];
  let seen = new Set<bigint>();
  let current: AssistantMessage | undefined = d.lastMessage;

  while (current && !seen.has(current.oid)) {
    history.push(current);
    seen.add(current.oid);

    current = current.parentMessageOid
      ? d.messagesByOid.get(current.parentMessageOid)
      : undefined;
  }

  return history.reverse();
};

let fetchConversationItemBlock = async (d: {
  conversation: AssistantConversation;
  beforeItemOid: bigint;
  blockSize: number;
}) =>
  await db.assistantConversationItem.findMany({
    where: {
      conversationOid: d.conversation.oid,
      oid: {
        lte: d.beforeItemOid
      }
    },
    include: {
      message: true
    },
    orderBy: {
      oid: 'desc'
    },
    take: d.blockSize
  });

export let getConversationHistory = async (d: {
  conversation: AssistantConversation;
  lastMessageId: string;
  size: number;
  blockSize?: number;
}) => {
  if (d.size <= 0) return [];

  let blockSize = Math.max(1, Math.floor(d.blockSize ?? DEFAULT_BLOCK_SIZE));
  let lastConversationItem = await db.assistantConversationItem.findFirst({
    where: {
      conversationOid: d.conversation.oid,
      message: {
        id: d.lastMessageId
      }
    },
    include: {
      message: true
    }
  });

  if (!lastConversationItem) {
    throw new ServiceError(notFoundError('assistant_message', d.lastMessageId));
  }

  let messagesByOid = new Map<bigint, AssistantMessage>();
  let oldestFetchedItemOid = lastConversationItem.oid + 1n;
  let lastMessage = lastConversationItem.message;
  let history: AssistantMessage[] = [];

  while (history.length < d.size) {
    let items: ConversationItemWithMessage[] = await fetchConversationItemBlock({
      conversation: d.conversation,
      beforeItemOid: oldestFetchedItemOid - 1n,
      blockSize
    });

    if (items.length == 0) break;

    for (let item of items) {
      messagesByOid.set(item.message.oid, item.message);
    }

    oldestFetchedItemOid = items[items.length - 1]!.oid;
    history = buildHistory({ lastMessage, messagesByOid });

    if (items.length < blockSize) break;
  }

  return history.slice(-d.size);
};
