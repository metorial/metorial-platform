import type {
  Slate,
  SlateAction,
  SlateAttachment,
  SlateAuthConfig,
  SlateAuthMethod,
  SlateDeployment,
  SlateError,
  SlateInstance,
  SlateInstanceConfig,
  SlateInstanceOAuthSetup,
  SlateInstanceOAuthSetupEvent,
  SlateInvocation,
  SlateOAuthCredentials,
  SlateSession,
  SlateSessionToolCall,
  SlateVersion,
  Tenant
} from '../../prisma/generated/client';
import { slateAuthConfigPresenter } from './slateAuthConfig';
import { slateInvocationLitePresenter, slateInvocationPresenter } from './slateInvocation';

type InvocationWithStoredAttachments = SlateInvocation & {
  slateInvocationAttachment?: Array<{
    attachments: SlateAttachment;
  }>;
};

type ListSlateError = SlateError & {
  tenant: Tenant;
  slate: Slate | null;
  slateVersion: SlateVersion | null;
  slateInstance: SlateInstance | null;
  invocation: InvocationWithStoredAttachments | null;
};

export let slateErrorLitePresenter = async (error: ListSlateError) => ({
  object: 'slate.error' as const,

  id: error.id,
  type: error.type,

  errorCode: error.errorCode,
  errorMessage: error.errorMessage,

  tenantId: error.tenant.id,
  slateId: error.slate?.id ?? null,
  slateVersionId: error.slateVersion?.id ?? null,
  slateInstanceId: error.slateInstance?.id ?? null,
  invocationId: error.invocation?.id ?? null,

  createdAt: error.createdAt
});

type FullSlateError = ListSlateError & {
  toolCall:
    | (SlateSessionToolCall & {
        action: SlateAction;
        session: SlateSession;
        slateVersion: SlateVersion;
        invocation: InvocationWithStoredAttachments & {
          deployment: SlateDeployment & {
            slateVersion: SlateVersion;
          };
        };
      })
    | null;
  session: SlateSession | null;
  authConfig:
    | (SlateAuthConfig & {
        authMethod: SlateAuthMethod;
        oauthCredentials: SlateOAuthCredentials | null;
        slate: Slate;
      })
    | null;
  instanceConfig: SlateInstanceConfig | null;
  oauthSetup:
    | (SlateInstanceOAuthSetup & {
        authMethod: SlateAuthMethod;
        oauthCredentials: SlateOAuthCredentials;
        slateVersion: SlateVersion;
        events: SlateInstanceOAuthSetupEvent[];
      })
    | null;
};

export let slateErrorFullPresenter = async (error: FullSlateError) => {
  let lite = await slateErrorLitePresenter(error);

  return {
    ...lite,

    invocation: error.invocation
      ? await slateInvocationLitePresenter(error.invocation)
      : null,

    toolCall: error.toolCall
      ? {
          id: error.toolCall.id,
          status: error.toolCall.status,
          sessionId: error.toolCall.session.id,
          slateVersionId: error.toolCall.slateVersion.id,
          error: error.toolCall.errorCode
            ? {
                code: error.toolCall.errorCode,
                message: error.toolCall.errorMessage ?? error.toolCall.errorCode
              }
            : null,
          durationMs: error.toolCall.durationMs,
          action: {
            id: error.toolCall.action.id,
            key: error.toolCall.action.key,
            name: error.toolCall.action.name
          },
          invocation: await slateInvocationPresenter(error.toolCall.invocation),
          createdAt: error.toolCall.createdAt
        }
      : null,

    session: error.session
      ? {
          id: error.session.id,
          createdAt: error.session.createdAt,
          lastActiveAt: error.session.lastActiveAt
        }
      : null,

    authConfig: error.authConfig
      ? slateAuthConfigPresenter(error.authConfig)
      : null,

    instanceConfig: error.instanceConfig
      ? {
          id: error.instanceConfig.id,
          errorCode: error.instanceConfig.errorCode,
          errorMessage: error.instanceConfig.errorMessage,
          errorInvocationId: error.instanceConfig.errorInvocationId,
          createdAt: error.instanceConfig.createdAt
        }
      : null,

    oauthSetup: error.oauthSetup
      ? {
          id: error.oauthSetup.id,
          status: error.oauthSetup.status,
          errorCode: error.oauthSetup.errorCode,
          errorMessage: error.oauthSetup.errorMessage,
          slateVersionId: error.oauthSetup.slateVersion.id,
          authMethodKey: error.oauthSetup.authMethod.key,
          events: error.oauthSetup.events.map(e => ({
            type: e.type,
            createdAt: e.createdAt
          })),
          createdAt: error.oauthSetup.createdAt
        }
      : null
  };
};
