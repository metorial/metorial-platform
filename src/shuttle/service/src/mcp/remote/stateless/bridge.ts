import { generatePlainId } from '@lowerdeck/id';
import type {
  JSONRPCError,
  JSONRPCMessage,
  JSONRPCRequest,
  JSONRPCResponse
} from '@modelcontextprotocol/sdk/types.js';
import {
  HEADER_MISMATCH_ERROR_CODE,
  MISSING_REQUIRED_CLIENT_CAPABILITY_ERROR_CODE,
  UNSUPPORTED_PROTOCOL_VERSION_ERROR_CODE
} from '../../../lib/remote/modernError';
import {
  HttpResponseError,
  toConnectionError,
  type ConnectionErrorPayload
} from '../../utils/connectionError';
import type { ConnectionMessage } from '../../utils/messenger';
import {
  INTERNAL_ERROR_CODE,
  META_CLIENT_CAPABILITIES,
  META_CLIENT_INFO,
  META_LOG_LEVEL,
  META_PROTOCOL_VERSION,
  META_SERVER_INFO,
  METHOD_NOT_FOUND_ERROR_CODE,
  STATELESS_PROTOCOL_UNSUPPORTED_CODE,
  STATELESS_PROTOCOL_VERSION
} from './constants';
import {
  getToolParamHeaders,
  validateToolHeaderAnnotations,
  type ToolHeaderAnnotation
} from './headers';
import {
  buildRetryParams,
  InputRequestRound,
  isInputRequiredResult,
  type InputRequiredResult
} from './mrtr';
import {
  buildSubscriptionFilter,
  SubscriptionStream,
  toLegacySubscriptionMessage,
  type SubscriptionFilter,
  type SubscriptionStreamOutcome
} from './subscriptions';
import { postStatelessRequest } from './transport';

let MAX_INPUT_ROUNDS = 10;
let MAX_TOOL_LIST_PAGES = 100;
let DEFAULT_INPUT_RESPONSE_TIMEOUT_MS = 10 * 60 * 1000;
let DEFAULT_LEGACY_PROTOCOL_VERSION = '2025-06-18';
let DEFAULT_CLIENT_INFO = { name: 'Metorial', version: '1.0.0' };

let FATAL_SUBSCRIPTION_CODES = new Set(['authentication_failed', 'egress_policy_blocked']);

type FinalMessage = JSONRPCResponse | JSONRPCError;

let isLegacyRejectionStatus = (status: number) =>
  status >= 400 && status < 500 && status != 401 && status != 403;

type ExchangeOutcome =
  | { type: 'response'; message: FinalMessage }
  | { type: 'aborted' }
  | { type: 'failed'; error: unknown };

export interface StatelessMcpBridgeOptions {
  url: string;
  egressPolicy?: PrismaJson.CompiledEgressNetworkAllowList | null;
  getHeaders: () => Promise<Record<string, string>>;
  emit: (message: ConnectionMessage) => Promise<void>;
  log: (type: 'debug.info' | 'debug.warning' | 'debug.error', message: string) => void;
  inputResponseTimeoutMs?: number;
}

export class StatelessMcpBridge {
  readonly #abortController = new AbortController();
  readonly #inflight = new Map<string | number, AbortController>();
  readonly #inputRounds = new Set<InputRequestRound>();
  readonly #toolHeaders = new Map<string, ToolHeaderAnnotation[]>();
  readonly #resourceUris = new Set<string>();
  readonly #subscriptions: SubscriptionStream;

  #clientInfo: Record<string, unknown> = DEFAULT_CLIENT_INFO;
  #clientCapabilities: Record<string, unknown> = {};
  #logLevel: string | null = null;
  #serverCapabilities: Record<string, any> | null = null;
  #closed = false;

  constructor(private readonly opts: StatelessMcpBridgeOptions) {
    this.#subscriptions = new SubscriptionStream((filter, signal) =>
      this.#listen(filter, signal)
    );
  }

  async handle(message: JSONRPCMessage) {
    if (this.#closed) {
      await this.#emitError({
        code: 'connection_closed',
        message: 'The connection to the MCP server is shutting down'
      });
      return;
    }

    if (!('method' in message)) {
      this.#consumeInputResponse(message);
      return;
    }

    if (!('id' in message)) {
      this.#handleNotification(message);
      return;
    }

    let request = message as JSONRPCRequest;

    switch (request.method) {
      case 'initialize':
        await this.#initialize(request);
        return;

      case 'ping':
        await this.#reply(request.id, {});
        return;

      case 'logging/setLevel':
        this.#logLevel =
          typeof request.params?.level == 'string' ? request.params.level : null;
        await this.#reply(request.id, {});
        return;

      case 'resources/subscribe':
      case 'resources/unsubscribe':
        await this.#updateResourceSubscription(request);
        return;

      default:
        void this.#forward(request);
    }
  }

  close() {
    if (this.#closed) return;
    this.#closed = true;

    this.#abortController.abort();
    this.#subscriptions.close();

    for (let round of this.#inputRounds) round.cancel(new Error('Connection closed'));
    this.#inputRounds.clear();
  }

  async #initialize(request: JSONRPCRequest) {
    let params = (request.params ?? {}) as Record<string, any>;
    this.#clientInfo = params.clientInfo ?? DEFAULT_CLIENT_INFO;
    this.#clientCapabilities = params.capabilities ?? {};

    let outcome = await this.#exchange(
      { jsonrpc: '2.0', id: `discover_${generatePlainId(12)}`, method: 'server/discover' },
      this.#abortController.signal,
      { forwardNotifications: false }
    );

    if (outcome.type == 'aborted') return;
    if (outcome.type == 'failed') {
      await this.#emitError(this.#mapDiscoverFailure(outcome.error));
      return;
    }

    let discovered = this.#parseDiscoverResponse(outcome.message);
    if ('error' in discovered) {
      await this.#emitError(discovered.error);
      return;
    }

    this.#serverCapabilities = discovered.capabilities;

    await this.#reply(request.id, {
      protocolVersion: params.protocolVersion ?? DEFAULT_LEGACY_PROTOCOL_VERSION,
      capabilities: discovered.capabilities,
      serverInfo: discovered.serverInfo,
      ...(discovered.instructions ? { instructions: discovered.instructions } : {})
    });

    this.#refreshSubscriptions();
  }

  #mapDiscoverFailure(error: unknown): ConnectionErrorPayload {
    if (!(error instanceof HttpResponseError) || !isLegacyRejectionStatus(error.status)) {
      return toConnectionError(error, 'initialize_failed');
    }

    return {
      code: STATELESS_PROTOCOL_UNSUPPORTED_CODE,
      message: `The MCP server rejected a stateless (${STATELESS_PROTOCOL_VERSION}) request with HTTP ${error.status}. It may only support the session-based transports.`
    };
  }

  #parseDiscoverResponse(
    message: FinalMessage
  ):
    | { error: ConnectionErrorPayload }
    | { capabilities: Record<string, any>; serverInfo: unknown; instructions?: string } {
    let fallbackServerInfo = { name: new URL(this.opts.url).hostname, version: 'unknown' };

    if ('error' in message) {
      if (message.error.code == METHOD_NOT_FOUND_ERROR_CODE) {
        this.opts.log(
          'debug.warning',
          'MCP server does not implement server/discover, assuming tool support only'
        );
        return { capabilities: { tools: {} }, serverInfo: fallbackServerInfo };
      }

      if (message.error.code == UNSUPPORTED_PROTOCOL_VERSION_ERROR_CODE) {
        return {
          error: this.#unsupportedVersionError((message.error.data as any)?.supported)
        };
      }

      return {
        error: {
          code: 'protocol_error',
          message: `The MCP server failed to answer server/discover: ${message.error.message}`
        }
      };
    }

    let result = (message.result ?? {}) as Record<string, any>;
    let supported = result.supportedVersions;

    if (Array.isArray(supported) && !supported.includes(STATELESS_PROTOCOL_VERSION)) {
      return { error: this.#unsupportedVersionError(supported) };
    }

    return {
      capabilities: result.capabilities ?? {},
      serverInfo: result._meta?.[META_SERVER_INFO] ?? fallbackServerInfo,
      instructions: typeof result.instructions == 'string' ? result.instructions : undefined
    };
  }

  #unsupportedVersionError(supported: unknown): ConnectionErrorPayload {
    let versions = Array.isArray(supported) ? supported.join(', ') : 'unknown';

    return {
      code: STATELESS_PROTOCOL_UNSUPPORTED_CODE,
      message: `The MCP server does not support protocol version ${STATELESS_PROTOCOL_VERSION} (supported: ${versions})`
    };
  }

  async #forward(request: JSONRPCRequest) {
    let abortController = new AbortController();
    this.#inflight.set(request.id, abortController);

    try {
      let outcome = await this.#exchange(request, abortController.signal);
      if (outcome.type == 'aborted') return;
      if (outcome.type == 'failed') {
        await this.#emitError(toConnectionError(outcome.error));
        return;
      }

      let final = await this.#resolve(request, outcome.message, abortController.signal);
      if (!final) return;

      await this.#emitMessage({ ...final, id: request.id } as JSONRPCMessage);
    } finally {
      this.#inflight.delete(request.id);
    }
  }

  async #resolve(
    original: JSONRPCRequest,
    initial: FinalMessage,
    signal: AbortSignal
  ): Promise<FinalMessage | null> {
    let current = original;
    let response = initial;
    let hasRetriedHeaders = false;
    let rounds = 0;

    while (true) {
      if ('error' in response) {
        let canRetryHeaders =
          response.error.code == HEADER_MISMATCH_ERROR_CODE &&
          current.method == 'tools/call' &&
          !hasRetriedHeaders;

        if (!canRetryHeaders) return response;

        hasRetriedHeaders = true;
        await this.#refreshToolHeaders(signal);
      } else if (current.method == 'tools/list') {
        return { ...response, result: this.#processToolList(response.result) };
      } else if (!isInputRequiredResult(response.result)) {
        return response;
      } else {
        if (rounds >= MAX_INPUT_ROUNDS) {
          return this.#errorResponse(
            original.id,
            INTERNAL_ERROR_CODE,
            'The MCP server requested additional input too many times'
          );
        }

        rounds++;

        let inputResponses = await this.#collectInput(response.result, signal);
        if (inputResponses.type == 'aborted') return null;
        if (inputResponses.type == 'error') return inputResponses.error;

        current = {
          ...current,
          id: `mrtr_retry_${generatePlainId(12)}`,
          params: buildRetryParams(current.params, response.result, inputResponses.value)
        };
      }

      let outcome = await this.#exchange(current, signal);
      if (outcome.type == 'aborted') return null;
      if (outcome.type == 'failed') {
        await this.#emitError(toConnectionError(outcome.error));
        return null;
      }

      response = outcome.message;
    }
  }

  async #collectInput(
    result: InputRequiredResult,
    signal: AbortSignal
  ): Promise<
    | { type: 'value'; value: Record<string, unknown> }
    | { type: 'aborted' }
    | { type: 'error'; error: FinalMessage }
  > {
    let round = InputRequestRound.create(result, this.#clientCapabilities);

    if (round.unsupportedKeys.length && !round.legacyRequests.length) {
      return {
        type: 'error',
        error: this.#errorResponse(
          0,
          MISSING_REQUIRED_CLIENT_CAPABILITY_ERROR_CODE,
          'The MCP server requested input that the connected client does not support'
        )
      };
    }

    if (round.unsupportedKeys.length) {
      this.opts.log(
        'debug.warning',
        `Skipping unsupported input requests: ${round.unsupportedKeys.join(', ')}`
      );
    }

    this.#inputRounds.add(round);

    let onAbort = () => round.cancel(new Error('Request cancelled'));
    signal.addEventListener('abort', onAbort, { once: true });

    let timeout = setTimeout(
      () => round.cancel(new Error('Timed out waiting for input')),
      this.opts.inputResponseTimeoutMs ?? DEFAULT_INPUT_RESPONSE_TIMEOUT_MS
    );

    try {
      for (let legacyRequest of round.legacyRequests) await this.#emitMessage(legacyRequest);

      return { type: 'value', value: await round.wait() };
    } catch (error) {
      if (signal.aborted) return { type: 'aborted' };

      return {
        type: 'error',
        error: this.#errorResponse(
          0,
          INTERNAL_ERROR_CODE,
          error instanceof Error ? error.message : 'Failed to collect input'
        )
      };
    } finally {
      clearTimeout(timeout);
      signal.removeEventListener('abort', onAbort);
      this.#inputRounds.delete(round);
    }
  }

  #consumeInputResponse(message: JSONRPCMessage) {
    for (let round of this.#inputRounds) {
      if (round.consume(message)) return;
    }

    this.opts.log('debug.info', 'Ignoring client response that matches no pending request');
  }

  #handleNotification(message: JSONRPCMessage & { method: string }) {
    if (message.method != 'notifications/cancelled') return;

    let requestId = (message as { params?: { requestId?: string | number } }).params
      ?.requestId;
    if (requestId === undefined) return;

    this.#inflight.get(requestId)?.abort();
  }

  async #updateResourceSubscription(request: JSONRPCRequest) {
    let uri = request.params?.uri;

    if (typeof uri == 'string') {
      if (request.method == 'resources/subscribe') this.#resourceUris.add(uri);
      else this.#resourceUris.delete(uri);
    }

    this.#refreshSubscriptions();
    await this.#reply(request.id, {});
  }

  #refreshSubscriptions() {
    this.#subscriptions.update(
      buildSubscriptionFilter({
        serverCapabilities: this.#serverCapabilities,
        resourceUris: this.#resourceUris
      })
    );
  }

  async #listen(
    filter: SubscriptionFilter,
    signal: AbortSignal
  ): Promise<SubscriptionStreamOutcome> {
    let request: JSONRPCRequest = {
      jsonrpc: '2.0',
      id: `sub_${generatePlainId(12)}`,
      method: 'subscriptions/listen',
      params: { notifications: filter }
    };

    let listenError = null as JSONRPCError['error'] | null;

    let outcome = await this.#post(request, signal, async message => {
      if ('error' in message && message.id === request.id) {
        listenError = message.error;
        return;
      }

      let legacy = toLegacySubscriptionMessage(message);
      if (legacy) await this.#emitMessage(legacy);
    });

    if (outcome.type == 'aborted') return 'stop';

    if (outcome.type == 'completed') {
      if (!listenError) return 'reconnect';

      if (listenError.code == METHOD_NOT_FOUND_ERROR_CODE) {
        this.opts.log(
          'debug.warning',
          'MCP server does not implement subscriptions/listen, list-changed and resource notifications are unavailable'
        );
        return 'stop';
      }

      this.opts.log(
        'debug.warning',
        `MCP server rejected subscriptions/listen: ${listenError.message}`
      );
      return 'reconnect';
    }

    let mapped = toConnectionError(outcome.error);
    if (FATAL_SUBSCRIPTION_CODES.has(mapped.code)) {
      await this.#emitError(mapped);
      return 'stop';
    }

    this.opts.log(
      'debug.info',
      `Stateless subscription stream unavailable, reconnecting: ${mapped.message}`
    );
    return 'reconnect';
  }

  async #refreshToolHeaders(signal: AbortSignal) {
    this.#toolHeaders.clear();

    let cursor: string | undefined;

    for (let page = 0; page < MAX_TOOL_LIST_PAGES; page++) {
      let outcome = await this.#exchange(
        {
          jsonrpc: '2.0',
          id: `tools_${generatePlainId(12)}`,
          method: 'tools/list',
          params: cursor ? { cursor } : {}
        },
        signal,
        { forwardNotifications: false }
      );

      if (outcome.type != 'response' || 'error' in outcome.message) return;

      let result = this.#processToolList(outcome.message.result);
      cursor = typeof result.nextCursor == 'string' ? result.nextCursor : undefined;
      if (!cursor) return;
    }
  }

  #processToolList(result: Record<string, any>) {
    if (!Array.isArray(result?.tools)) return result;

    let tools = result.tools.filter((tool: any) => {
      let validation = validateToolHeaderAnnotations(tool?.inputSchema);

      if (!validation.ok) {
        this.opts.log('debug.warning', `Excluding tool "${tool?.name}": ${validation.reason}`);
        this.#toolHeaders.delete(tool?.name);
        return false;
      }

      if (validation.annotations.length) {
        this.#toolHeaders.set(tool.name, validation.annotations);
      } else {
        this.#toolHeaders.delete(tool.name);
      }

      return true;
    });

    return { ...result, tools };
  }

  async #exchange(
    request: JSONRPCRequest,
    signal: AbortSignal,
    opts: { forwardNotifications?: boolean } = {}
  ): Promise<ExchangeOutcome> {
    let final: FinalMessage | null = null;
    let forwardNotifications = opts.forwardNotifications ?? true;

    let outcome = await this.#post(request, signal, async message => {
      let isResponse = !('method' in message) && 'id' in message;

      if (isResponse && (message as FinalMessage).id === request.id) {
        final = message as FinalMessage;
        return;
      }

      if (forwardNotifications && 'method' in message && !('id' in message)) {
        await this.#emitMessage(message);
      }
    });

    if (outcome.type != 'completed') return outcome;
    if (final) return { type: 'response', message: final };

    return {
      type: 'failed',
      error: {
        code: 'protocol_error',
        message: 'The MCP server closed the response without answering the request'
      }
    };
  }

  async #post(
    request: JSONRPCRequest,
    signal: AbortSignal,
    onMessage: (message: JSONRPCMessage) => unknown
  ) {
    let headers: Record<string, string>;

    try {
      headers = {
        ...(await this.opts.getHeaders()),
        ...this.#getParamHeaders(request)
      };
    } catch (error) {
      return { type: 'failed' as const, error };
    }

    return postStatelessRequest({
      url: this.opts.url,
      request: this.#withMeta(request),
      headers,
      signal: AbortSignal.any([signal, this.#abortController.signal]),
      egressPolicy: this.opts.egressPolicy,
      onMessage
    });
  }

  #getParamHeaders(request: JSONRPCRequest) {
    if (request.method != 'tools/call') return {};

    let annotations = this.#toolHeaders.get(request.params?.name as string);
    if (!annotations) return {};

    return getToolParamHeaders(
      annotations,
      request.params?.arguments as Record<string, unknown> | undefined
    );
  }

  #withMeta(request: JSONRPCRequest): JSONRPCRequest {
    let params = (request.params ?? {}) as Record<string, any>;

    return {
      ...request,
      params: {
        ...params,
        _meta: {
          ...(params._meta ?? {}),
          [META_PROTOCOL_VERSION]: STATELESS_PROTOCOL_VERSION,
          [META_CLIENT_INFO]: this.#clientInfo,
          [META_CLIENT_CAPABILITIES]: this.#clientCapabilities,
          ...(this.#logLevel ? { [META_LOG_LEVEL]: this.#logLevel } : {})
        }
      }
    };
  }

  #errorResponse(id: string | number, code: number, message: string): JSONRPCError {
    return { jsonrpc: '2.0', id, error: { code, message } };
  }

  #reply(id: string | number, result: Record<string, unknown>) {
    return this.#emitMessage({ jsonrpc: '2.0', id, result } as JSONRPCMessage);
  }

  #emitMessage(message: JSONRPCMessage) {
    return this.opts.emit({ type: 'mcp.message', data: message });
  }

  async #emitError(error: ConnectionErrorPayload) {
    this.opts.log('debug.error', `Stateless HTTP connection error: ${error.message}`);
    await this.opts.emit({ type: 'error', data: error });
  }
}
