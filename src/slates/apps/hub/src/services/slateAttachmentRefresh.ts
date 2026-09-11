import { Service } from '@lowerdeck/service';
import type {
  Slate,
  SlateAttachment,
  SlateAuthConfig,
  SlateInstance,
  SlateInstanceConfig,
  Tenant
} from '../../prisma/generated/client';
import { db } from '../db';
import { GET_FILE_URL_TOOL_ID } from '../lib/reservedActions';
import { slateErrorService } from './slateError';
import { slateAuthHandlerService } from './slateInstanceAuthHandler';
import { slateInvocationService } from './slateInvocation';
import { slateSessionService } from './slateSession';

let REFRESH_BACKOFF_BASE_MS = 30_000;
let REFRESH_BACKOFF_MAX_MS = 60 * 60_000;

let buildInvocationAuth = (auth: {
  output?: Record<string, any> | null;
  input?: Record<string, any> | null;
  authMethod: { key: string };
}) => ({
  authenticationMethodId: auth.authMethod.key,
  data: auth.output ?? auth.input ?? {}
});

export type RefreshableAttachment = SlateAttachment & {
  tenant: Tenant | null;
  authConfig: SlateAuthConfig | null;
  slateInstance:
    | (SlateInstance & { slate: Slate; currentConfig: SlateInstanceConfig | null })
    | null;
};

export let refreshableAttachmentInclude = {
  tenant: true,
  authConfig: true,
  slateInstance: { include: { slate: true, currentConfig: true } }
} as const;

class SlateAttachmentRefreshServiceImpl {
  async refreshProxiedAttachment(d: { attachment: RefreshableAttachment }) {
    let { attachment } = d;

    if (!attachment.slateInstance || !attachment.tenant) return attachment;

    try {
      let version = await slateSessionService.getSessionVersion({
        slate: attachment.slateInstance.slate,
        slateInstance: attachment.slateInstance
      });

      let auth = null as { authenticationMethodId: string; data: Record<string, any> } | null;
      if (attachment.authConfigOid) {
        let authRes = await slateAuthHandlerService.getSlateInstanceAuth({
          tenant: attachment.tenant,
          slateInstance: attachment.slateInstance,
          authConfigId: attachment.authConfig!.id,
          minExpirationBuffer: 30 * 1000
        });
        auth = buildInvocationAuth(authRes);
      }

      let stack = await slateInvocationService.createInvocationWithState({
        tenant: attachment.tenant,
        participants: [{ type: 'hub', id: 'attachment-refresh', name: 'Attachment Refresh' }],
        slateVersion: version,
        config: attachment.slateInstance.currentConfig?.value ?? {},
        session: { id: `attachment-refresh:${attachment.id}`, state: {} },
        auth
      });

      let res = await slateInvocationService.invokeToolAction({
        stack,
        actionId: GET_FILE_URL_TOOL_ID,
        input: { url: attachment.targetUrl, reference: attachment.refreshReference ?? null }
      });

      if (res.status === 'error') {
        return this.recordFailure({
          attachment,
          errorCode: res.error.code,
          errorMessage: res.error.message,
          invocationOid: res.invocation.oid
        });
      }

      let output = res.data.output as {
        url: string;
        expiresAt: string;
        headers?: Record<string, string>;
        query?: Record<string, string>;
      };

      return await db.slateAttachment.update({
        where: { oid: attachment.oid },
        data: {
          targetUrl: output.url,
          headers: output.headers ?? attachment.headers ?? undefined,
          query: output.query ?? attachment.query ?? undefined,
          refreshAfter: new Date(output.expiresAt),
          lastRefreshedAt: new Date(),
          refreshFailureCount: 0,
          lastRefreshErrorCode: null,
          lastRefreshErrorMessage: null
        },
        include: refreshableAttachmentInclude
      });
    } catch (err) {
      return this.recordFailure({
        attachment,
        errorCode: 'attachment_refresh_exception',
        errorMessage: err instanceof Error ? err.message : String(err)
      });
    }
  }

  private async recordFailure(d: {
    attachment: RefreshableAttachment;
    errorCode: string;
    errorMessage: string;
    invocationOid?: bigint;
  }) {
    let { attachment } = d;

    slateErrorService
      .recordSlateError({
        type: 'attachment_refresh_failed',
        errorCode: d.errorCode,
        errorMessage: d.errorMessage,
        tenantOid: attachment.tenantOid!,
        slateInstanceOid: attachment.slateInstanceOid,
        authConfigOid: attachment.authConfigOid,
        invocationOid: d.invocationOid
      })
      .catch(() => {});

    let nextAttemptDelayMs = Math.min(
      REFRESH_BACKOFF_BASE_MS * 2 ** attachment.refreshFailureCount,
      REFRESH_BACKOFF_MAX_MS
    );

    return db.slateAttachment.update({
      where: { oid: attachment.oid },
      data: {
        refreshAfter: new Date(Date.now() + nextAttemptDelayMs),
        refreshFailureCount: { increment: 1 },
        lastRefreshErrorCode: d.errorCode,
        lastRefreshErrorMessage: d.errorMessage
      },
      include: refreshableAttachmentInclude
    });
  }
}

export let slateAttachmentRefreshService = Service.create(
  'slateAttachmentRefreshService',
  () => new SlateAttachmentRefreshServiceImpl()
).build();
