import {
  badRequestError,
  conflictError,
  forbiddenError,
  notFoundError,
  ServiceError,
  tooManyRequestsError
} from '@lowerdeck/error';
import type { AdapterCallFailureOutput, AdapterCallResult } from '@metorial-subspace/adapter';
import {
  type ChatErrorCode,
  chatErrorCodeChain,
  chatErrorMessage,
  chatErrorProviderCode,
  chatErrorRetryAfterMs,
  getChatErrorInfo,
  isChatErrorCode,
  isChatErrorRetryable,
  parseChatError
} from '@slates/adapter-chat';

export type { ChatErrorCode, ChatErrorInfo, ParsedChatError } from '@slates/adapter-chat';

let NOT_FOUND_ENTITIES: Partial<Record<ChatErrorCode, string>> = {
  'chat.channel.not_found': 'chatChannel',
  'chat.message.not_found': 'chatMessage',
  'chat.thread.not_found': 'chatThread',
  'chat.user.not_found': 'chatUser',
  'chat.workspace.not_found': 'chatWorkspace',
  'chat.attachment.not_found': 'chatAttachment',
  'chat.emoji.not_found': 'chatEmoji',
  'chat.command.not_found': 'chatCommand',
  'chat.reaction.not_found': 'chatReaction',
  'chat.interaction.modal_not_found': 'chatModal'
};

let FORBIDDEN_CODES: ChatErrorCode[] = [
  'chat.auth.invalid',
  'chat.auth.expired',
  'chat.auth.missing_scope',
  'chat.auth.user_token_required',
  'chat.auth.app_not_installed',
  'chat.access.not_a_member',
  'chat.access.forbidden',
  'chat.access.dm_not_allowed'
];

let CONFLICT_CODES: ChatErrorCode[] = [
  'chat.access.channel_archived',
  'chat.message.not_editable',
  'chat.message.not_deletable',
  'chat.message.duplicate',
  'chat.reaction.already_exists',
  'chat.reaction.limit_reached'
];

export interface ChatCallErrorOptions {
  code?: string;
  message?: string;
}

export let chatCallErrorToServiceError = (
  output: AdapterCallFailureOutput | unknown,
  options: ChatCallErrorOptions = {}
): ServiceError<any> => {
  let fallbackMessage = options.message ?? 'The chat provider rejected the request.';
  let info = getChatErrorInfo(output);

  if (!info) {
    return new ServiceError(
      badRequestError({
        code: options.code ?? 'chat_provider_error',
        message: fallbackMessage
      })
    );
  }

  let message = chatErrorMessage(info.code);
  let code = info.code;

  let entity = NOT_FOUND_ENTITIES[code];
  if (entity) return new ServiceError(notFoundError(entity, info.target?.id));

  if (FORBIDDEN_CODES.includes(code)) {
    return new ServiceError(forbiddenError({ message, code }));
  }

  if (CONFLICT_CODES.includes(code)) {
    return new ServiceError(conflictError({ message, code }));
  }

  if (code === 'chat.rate_limit.exceeded') {
    return new ServiceError(tooManyRequestsError({ message, code }));
  }

  return new ServiceError(badRequestError({ code, message }));
};

export let unwrapChatCall = <Output>(
  result: AdapterCallResult<Output>,
  options: ChatCallErrorOptions = {}
): Output => {
  if (result.result.type === 'success') return result.result.output;
  throw chatCallErrorToServiceError(result.result.output, options);
};

export let shouldRetryChatCall = (output: AdapterCallFailureOutput | unknown) => {
  let info = getChatErrorInfo(output);
  if (!info) return true;

  return isChatErrorRetryable(output);
};

export let isChatCallError = (
  output: AdapterCallFailureOutput | unknown,
  code: ChatErrorCode | readonly ChatErrorCode[],
  options: { includeCauses?: boolean } = {}
) => isChatErrorCode(output, code, options);

export let getChatCallErrorInfo = (output: AdapterCallFailureOutput | unknown) =>
  getChatErrorInfo(output);

export let describeChatFailure = (output: AdapterCallFailureOutput | unknown) => {
  let parsed = parseChatError(output);
  if (!parsed) return { code: 'unknown', message: 'Unknown chat adapter failure' };

  return {
    code: parsed.chat?.code ?? parsed.slate.code,
    slateCode: parsed.slate.code,
    message: parsed.slate.message,
    status: parsed.slate.status,
    retryable: isChatErrorRetryable(output),
    retryAfterMs: chatErrorRetryAfterMs(output),
    providerCode: chatErrorProviderCode(output),
    chain: parsed.chat ? chatErrorCodeChain(parsed.chat) : undefined,
    target: parsed.chat?.target,
    scopes: parsed.chat?.scopes,
    capability: parsed.chat?.capability
  };
};
