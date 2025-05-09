import { generateId } from '@metorial/id';

export type ExecutionContext = {
  contextId: string;
  parent?: ExecutionContext;
} & (
  | {
      type: 'request';
      userId?: string;
      memberId?: string;
      apiKeyId?: string;
      machineAccessId?: string;
      ip: string;
      userAgent: string;
    }
  | { type: 'scheduled'; cron: string; name: string }
  | { type: 'job'; queue: string }
  | { type: 'unknown' }
);

export let createExecutionContext = (
  input: ExecutionContext & { contextId?: string | undefined }
) => {
  if (!input.contextId) input.contextId = generateId('ctx_');

  return input as ExecutionContext;
};
