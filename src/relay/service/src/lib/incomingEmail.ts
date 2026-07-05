import EmailForwardParser from 'email-forward-parser';
import EmailReplyParser from 'email-reply-parser';
import { htmlToText } from 'html-to-text';
import PostalMime from 'postal-mime';

type ParsedAddress = {
  address?: string;
  name?: string;
};

let normalizeWhitespace = (text: string) =>
  text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

export let normalizeEmailAddress = (email: string | null | undefined) =>
  email?.trim().replace(/^<|>$/g, '').toLowerCase();

let normalizeMessageId = (messageId: string | null | undefined) =>
  messageId?.trim().replace(/^<|>$/g, '').toLowerCase();

export let extractMessageIdsFromHeader = (value: string | null | undefined) => {
  if (!value) return [];

  let matches = [...value.matchAll(/<([^>]+)>/g)].map(match => normalizeMessageId(match[1]));
  if (matches.length > 0) return matches.filter((id): id is string => !!id);

  return value
    .split(/\s+/g)
    .map(normalizeMessageId)
    .filter((id): id is string => !!id);
};

let headerValueToString = (value: unknown): string | null => {
  if (typeof value == 'string') return value;
  if (typeof value == 'number' || typeof value == 'boolean') return `${value}`;
  if (Array.isArray(value)) return value.map(headerValueToString).filter(Boolean).join(', ');
  if (value && typeof value == 'object' && 'value' in value) {
    return headerValueToString((value as { value?: unknown }).value);
  }
  return null;
};

let getHeaders = (email: any): [string, string][] => {
  let headers = email.headers;

  if (!headers) return [];

  if (Array.isArray(headers)) {
    return headers
      .map((header: any): [string, string] | null => {
        let key = header.key ?? header.name;
        let value = headerValueToString(header.value ?? header.line ?? header);
        if (!key || !value) return null;
        return [`${key}`.toLowerCase(), value];
      })
      .filter((header: [string, string] | null): header is [string, string] => !!header);
  }

  if (headers instanceof Map) {
    return [...headers.entries()]
      .map(([key, value]): [string, string] | null => {
        let stringValue = headerValueToString(value);
        if (!stringValue) return null;
        return [`${key}`.toLowerCase(), stringValue];
      })
      .filter((header: [string, string] | null): header is [string, string] => !!header);
  }

  if (typeof headers == 'object') {
    return Object.entries(headers)
      .map(([key, value]): [string, string] | null => {
        let stringValue = headerValueToString(value);
        if (!stringValue) return null;
        return [key.toLowerCase(), stringValue];
      })
      .filter((header: [string, string] | null): header is [string, string] => !!header);
  }

  return [];
};

export let getHeader = (headers: [string, string][], key: string) =>
  headers.find(header => header[0].toLowerCase() == key.toLowerCase())?.[1] ?? null;

let normalizeAddresses = (addresses: ParsedAddress[] | ParsedAddress | undefined | null) => {
  if (!addresses) return [];
  let list = Array.isArray(addresses) ? addresses : [addresses];

  return list
    .map(address => normalizeEmailAddress(address.address))
    .filter((address): address is string => !!address);
};

let parseHeaderAddresses = (value: string | null) => {
  if (!value) return [];

  return value
    .split(',')
    .map(part => normalizeEmailAddress(part.match(/<([^>]+)>/)?.[1] ?? part))
    .filter((address): address is string => !!address);
};

let getRecipientAddresses = (email: any, headers: [string, string][]) => [
  ...normalizeAddresses(email.to),
  ...normalizeAddresses(email.cc),
  ...normalizeAddresses(email.bcc),
  ...parseHeaderAddresses(getHeader(headers, 'delivered-to')),
  ...parseHeaderAddresses(getHeader(headers, 'x-original-to')),
  ...parseHeaderAddresses(getHeader(headers, 'envelope-to'))
];

export let normalizeThreadSubject = (subject: string) => {
  let normalized = subject.trim();

  while (/^((re|fw|fwd)\s*:\s*)/i.test(normalized)) {
    normalized = normalized.replace(/^((re|fw|fwd)\s*:\s*)/i, '').trim();
  }

  return normalized || '(no subject)';
};

let processText = (text: string, subject: string) => {
  let replyText = normalizeWhitespace(new EmailReplyParser().parseReply(text));
  let forward = new EmailForwardParser().read(replyText, subject);

  if (forward.forwarded && forward.email?.body) {
    return normalizeWhitespace(forward.email.body);
  }

  return replyText;
};

export let parseIncomingEmail = async (raw: string) => {
  let email = await PostalMime.parse(raw);
  let headers = getHeaders(email);
  let subject = email.subject || '';
  let text = email.text || '';

  if (!text && email.html) {
    text = htmlToText(email.html, {
      wordwrap: false,
      selectors: [
        { selector: 'img', format: 'skip' },
        { selector: 'a', options: { ignoreHref: true } }
      ]
    });
  }

  return {
    from: normalizeAddresses(email.from)[0] ?? '',
    recipients: [...new Set(getRecipientAddresses(email, headers))],
    subject,
    text: processText(text, subject),
    messageId: normalizeMessageId(email.messageId ?? getHeader(headers, 'message-id')),
    inReplyToIds: extractMessageIdsFromHeader(
      email.inReplyTo ?? getHeader(headers, 'in-reply-to')
    ),
    referenceIds: extractMessageIdsFromHeader(email.references ?? getHeader(headers, 'references')),
    headers
  };
};
