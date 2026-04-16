import type {
  SlateAttachment,
  SlateDeployment,
  SlateInvocation,
  SlateVersion
} from '../../prisma/generated/client';
import { db } from '../db';
import { getStoredInvocationStorageKey } from '../lib/invocation/store';
import type { StoredSlateInvocation } from '../lib/invocation/types';
import { invocationsBucketRecord, storage } from '../storage';
import { slateInvocationAttachmentsPresenter } from './slateAttachment';

type InvocationWithStoredAttachments = SlateInvocation & {
  slateInvocationAttachment?: Array<{
    attachments: SlateAttachment;
  }>;
};

export let slateInvocationLitePresenter = async (inv: InvocationWithStoredAttachments) => {
  let i = 0;
  while (inv.isPending) {
    if (i++ > 10) {
    }

    let res = await db.slateInvocation.findUniqueOrThrow({
      where: { oid: inv.oid },
      include: {
        slateInvocationAttachment: {
          include: {
            attachments: true
          }
        }
      }
    });
    if (!res.isPending) {
      inv = {
        ...inv,
        ...res
      };

      break;
    }
  }

  let output = inv.isPending
    ? ({
        id: inv.id,
        requests: [],
        responses: [],
        logs: []
      } satisfies StoredSlateInvocation)
    : (JSON.parse(
        (
          await storage.getObject(
            invocationsBucketRecord.bucket,
            getStoredInvocationStorageKey(inv)
          )
        ).data.toString('utf-8')
      ) as StoredSlateInvocation);

  return {
    object: 'slate.invocation',

    id: inv.id,
    status: inv.isPending
      ? ('processing_result' as const)
      : output.provider?.status === 'failed' || inv.hasInvocationError
        ? ('invocation_failed' as const)
        : inv.hasResponseError
          ? ('message_failed' as const)
          : ('succeeded' as const),

    requests: output.requests,
    responses: output.responses,
    error: output.provider?.error,
    logs: (output.logs ?? []).map(([timestamp, message]) => ({
      timestamp,
      message
    })),
    attachments: await slateInvocationAttachmentsPresenter(inv),

    provider: output.provider
      ? {
          id: output.provider.id,
          status: output.provider.status,
          billedTimeMs: output.provider.billedTimeMs,
          computeTimeMs: output.provider.computeTimeMs
        }
      : null,

    createdAt: inv.createdAt
  };
};

export let slateInvocationPresenter = async (
  inv: InvocationWithStoredAttachments & {
    deployment: SlateDeployment & {
      slateVersion: SlateVersion;
    };
  }
) => {
  let inner = await slateInvocationLitePresenter(inv);

  return {
    ...inner,

    slateDeploymentId: inv.deployment.id,
    slateVersionId: inv.deployment.slateVersion.id
  };
};
