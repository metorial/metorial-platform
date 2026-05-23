import { createQueue } from '@mtsrc/queue';
import type { SlateErrorType } from '../../../prisma/generated/client';
import { env } from '../../env';
import { slateErrorService } from '../../services/slateError';

export let recordSlateErrorQueue = createQueue<{
  type: SlateErrorType;
  errorCode: string;
  errorMessage: string;
  tenantOid: string;
  slateOid: string | null;
  slateVersionOid: string | null;
  slateInstanceOid: string | null;
  invocationOid: string | null;
  toolCallOid: string | null;
  sessionOid: string | null;
  authConfigOid: string | null;
  instanceConfigOid: string | null;
  oauthSetupOid: string | null;
  triggerReceiverOid: string | null;
  triggerEventInputOid: string | null;
}>({
  name: 'shub/err/record',
  redisUrl: env.service.REDIS_URL
});

export let recordSlateErrorQueueProcessor = recordSlateErrorQueue.process(async data => {
  await slateErrorService.createSlateError(data);
});
