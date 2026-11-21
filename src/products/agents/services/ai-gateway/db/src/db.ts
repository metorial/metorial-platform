import { createDatabase } from '@lowerdeck/prisma-pg';
import { PrismaClient } from '../prisma/generated/client';

export * from '../prisma/generated/client';

export let { db, withTransaction, addAfterTransactionHook } = createDatabase({
  name: 'ai-gateway',
  url: ['SYNTHESIS_DATABASE_URL', 'DATABASE_URL'],
  createClient: adapter =>
    new PrismaClient({
      adapter,
      transactionOptions: {
        maxWait: 10000,
        timeout: 12000
      }
    }),
  afterHookDelayMs: 5000
});

declare global {
  namespace PrismaJson {
    type AssistantConversationInput = unknown;
    type AssistantMessageStateContent = import('./types').State;
    type AssistantMessageSerializedContent =
      import('./types').AssistantMessageSerializedContent;
    type AssistantRunCost = import('./types').AssistantRunCost;
    type AssistantRunMetadata = import('./types').AssistantRunMetadata;
    type SubspaceMcpToolList = import('./types').SubspaceMcpToolList;
  }
}

export type TransactionDB = Parameters<Parameters<typeof db.$transaction>[0]>[0];
