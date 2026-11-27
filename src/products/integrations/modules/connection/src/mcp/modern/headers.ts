import { modernError } from './results';
import { MODERN_ERROR_CODES, MODERN_NAMED_METHODS, type ModernErrorResponse } from './types';

let ENCODED_HEADER_PATTERN = /^=\?base64\?(.*)\?=$/i;

export type HeaderReader = (name: string) => string | undefined;

export let decodeMcpHeaderValue = (value: string | undefined) => {
  if (value === undefined) return undefined;

  let trimmed = value.trim();
  let encoded = trimmed.match(ENCODED_HEADER_PATTERN);
  if (!encoded) return trimmed;

  return Buffer.from(encoded[1]!, 'base64').toString('utf8');
};

let mismatch = (id: string | number | null, header: string, expected: unknown) =>
  modernError({
    id,
    code: MODERN_ERROR_CODES.headerMismatch,
    message: `Header ${header} is missing or does not match the request body`,
    data: { header, expected }
  });

export let validateModernHeaders = (d: {
  getHeader: HeaderReader;
  id: string | number | null;
  method: string;
  params: Record<string, any> | undefined;
  protocolVersion: string;
}): ModernErrorResponse | null => {
  let protocolVersionHeader = decodeMcpHeaderValue(d.getHeader('mcp-protocol-version'));
  if (protocolVersionHeader !== d.protocolVersion) {
    return mismatch(d.id, 'MCP-Protocol-Version', d.protocolVersion);
  }

  let methodHeader = decodeMcpHeaderValue(d.getHeader('mcp-method'));
  if (methodHeader !== d.method) {
    return mismatch(d.id, 'Mcp-Method', d.method);
  }

  let nameField = MODERN_NAMED_METHODS[d.method];
  if (!nameField) return null;

  let expectedName = d.params?.[nameField];
  let nameHeader = decodeMcpHeaderValue(d.getHeader('mcp-name'));
  if (typeof expectedName !== 'string' || nameHeader !== expectedName) {
    return mismatch(d.id, 'Mcp-Name', expectedName);
  }

  return null;
};
