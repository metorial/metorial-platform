import { createQueue, QueueRetryError, type IQueue } from '@mtsrc/queue';
import { generateText } from 'ai';
import { titleModel } from '../definitions/models/_util';
import { db } from '../db';
import { env } from '../env';
import type { State } from '../types';

type GenerateAssistantConversationTitleJob = {
  conversationId: string;
  messageId: string;
};

export let generateAssistantConversationTitleQueue: IQueue<
  GenerateAssistantConversationTitleJob,
  any
> = createQueue<GenerateAssistantConversationTitleJob>({
  name: 'assistant/conversation/title',
  redisUrl: env.service.REDIS_URL
});

let getFirstUserMessageText = (state: unknown) => {
  let parsed = state as State;
  let item = parsed.items?.find(item => item.type == 'message' && item.message.role == 'user');
  if (!item || item.type != 'message') return null;

  let parts = item.message.parts
    .map(part => {
      if (part.type == 'text') return part.text.trim();
      if (part.type == 'file') return `[File: ${part.filename || part.mediaType}]`;
      return null;
    })
    .filter((part): part is string => !!part && part.trim().length > 0);

  return parts.join('\n\n').trim() || null;
};

let sanitizeTitle = (value: string) => {
  let title = value
    .split('\n')[0]
    ?.replace(/^[Tt]itle:\s*/, '')
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[.!?]+$/g, '')
    .trim();

  if (!title) return null;

  return title.slice(0, 120).trim() || null;
};

export let generateAssistantConversationTitleQueueProcessor =
  generateAssistantConversationTitleQueue.process(
    async (data: GenerateAssistantConversationTitleJob) => {
      let conversation = await db.assistantConversation.findUnique({
        where: {
          id: data.conversationId
        }
      });
      if (!conversation) throw new QueueRetryError();
      if (conversation.title?.trim()) return;

      let firstUserMessage = await db.assistantConversationItem.findFirst({
        where: {
          conversationOid: conversation.oid,
          message: {
            type: 'user'
          }
        },
        include: {
          message: true
        },
        orderBy: {
          oid: 'asc'
        }
      });
      if (!firstUserMessage) throw new QueueRetryError();
      if (firstUserMessage.message.id != data.messageId) return;

      let firstUserMessageText = getFirstUserMessageText(firstUserMessage.message.state);
      if (!firstUserMessageText) return;

      let result = await generateText({
        model: (await titleModel).model,
        system: `Write short conversation titles.

Requirements:
- Base the title only on the user's first message
- Use 2 to 6 words
- Use sentence case
- Do not use quotes
- Do not add labels or explanations
- Return only the title`,
        prompt: `First user message:

${firstUserMessageText.slice(0, 4000)}`
      });

      let title = sanitizeTitle(result.text);
      if (!title) return;

      await db.assistantConversation.updateMany({
        where: {
          oid: conversation.oid,
          OR: [{ title: null }, { title: '' }]
        },
        data: {
          title
        }
      });
    }
  );
