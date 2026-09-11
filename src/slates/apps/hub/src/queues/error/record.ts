import { createQueue } from '@lowerdeck/queue';
import { Prisma } from '../../../prisma/generated/client';
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
}>({
  name: 'shub/err/record',
  redisUrl: env.service.REDIS_URL
});

export let recordSlateErrorQueueProcessor = recordSlateErrorQueue.process(async data => {
  try {
    await slateErrorService.createSlateError(data);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      console.warn('Skipping stale slate error record with missing relation.', {
        type: data.type,
        tenantOid: data.tenantOid,
        slateOid: data.slateOid,
        slateInstanceOid: data.slateInstanceOid
      });
      return;
    }

    throw error;
  }
});
