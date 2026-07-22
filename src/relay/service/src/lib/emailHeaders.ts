import type { IncomingEmail } from '../../prisma/generated/client';
import { extractMessageIdsFromHeader, getHeader } from './incomingEmail';

let formatMessageId = (messageId: string) => `<${messageId.replace(/^<|>$/g, '')}>`;

export let getReplyHeadersForIncomingEmail = (incomingEmail: IncomingEmail | null | undefined) => {
  if (!incomingEmail?.messageId) return undefined;

  let headers = Array.isArray(incomingEmail.headers)
    ? (incomingEmail.headers as [string, string][])
    : [];
  let references = [
    ...extractMessageIdsFromHeader(getHeader(headers, 'references')),
    incomingEmail.messageId
  ];

  return {
    inReplyTo: formatMessageId(incomingEmail.messageId),
    references: [...new Set(references)].map(formatMessageId)
  };
};
