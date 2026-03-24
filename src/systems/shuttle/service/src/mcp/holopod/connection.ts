import { generatePlainId } from '@lowerdeck/id';
import { ProgrammablePromise } from '@lowerdeck/programmable-promise';
import { getSentry } from '@lowerdeck/sentry';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import PQueue from 'p-queue';
import type { Tenant } from '../../../prisma/generated/browser';
import type {
  ContainerRegistry,
  ContainerRepository,
  ContainerRepositoryVersion,
  ServerConfig,
  ServerConnection
} from '../../../prisma/generated/client';
import { env } from '../../env';
import { safeParse } from '../../lib/safeParse';
import { secretService } from '../../services';
import { networkingRulesetService } from '../../services/networkRuleset';
import type { McpConnectionBackendAdapter } from '../connection/adapter';
import { ConnectionManager } from '../utils/connection';
import { ConnectionLogger } from '../utils/logger';
import { ConnectionMessenger } from '../utils/messenger';
import { createSessionClient, HolopodRunStream } from './client';
import { type RunResponse } from './types';

let Sentry = getSentry();

const CLEANUP_TIMEOUT_MS = 30 * 1000;
const PING_ID_PREFIX = 'mtsh/ping/';

let isDev = process.env.NODE_ENV !== 'production';
const DEFAULT_DNS_SERVERS = ['1.1.1.1', '8.8.8.8'] as const;

const getHolopodDnsServers = () => {
  let configured = env.holopod.HOLOPOD_NETWORK_DNS_SERVERS;
  if (!configured) return [...DEFAULT_DNS_SERVERS];

  let parsed = configured
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : [...DEFAULT_DNS_SERVERS];
};

let isMcpTraceEnabled = process.env.MCP_TRACE === 'true';
let mcpTraceLog = (...args: unknown[]) => {
  if (!isMcpTraceEnabled) return;
  console.log(`[${new Date().toISOString()}] [mcp-trace][holopod-connection]`, ...args);
};

export class HolopodConnection implements McpConnectionBackendAdapter {
  readonly #stream: HolopodRunStream;
  readonly #grpcClient: ReturnType<typeof createSessionClient>;
  readonly #initPromise = new ProgrammablePromise<void>();
  readonly #processingQueue = new PQueue({ concurrency: 1 });

  readonly logger: ConnectionLogger;
  readonly messenger: ConnectionMessenger;
  readonly manager: ConnectionManager;

  #lastMessageAt = Date.now();

  #initialized = false;
  #exited = false;
  #exiting = false;

  #holopodPingIv: NodeJS.Timeout | null = null;

  constructor(
    readonly tenant: Tenant,
    readonly connection: ServerConnection,
    readonly serverConfig: ServerConfig,
    readonly version: ContainerRepositoryVersion & {
      repository: ContainerRepository & {
        registry: ContainerRegistry;
      };
    }
  ) {
    mcpTraceLog('ctor', {
      connectionOid: (connection as any).oid ?? null,
      serverConfigOid: (serverConfig as any).oid ?? null
    });
    this.#grpcClient = createSessionClient();
    this.#stream = this.#grpcClient.run();

    this.logger = new ConnectionLogger(this.connection);
    this.messenger = new ConnectionMessenger();
    this.manager = new ConnectionManager(this.connection);

    this.init();
  }

  static async create(
    connection: ServerConnection,
    version: ContainerRepositoryVersion & {
      repository: ContainerRepository & {
        registry: ContainerRegistry;
      };
    },
    instance: ServerConfig,
    tenant: Tenant
  ) {
    return new HolopodConnection(tenant, connection, instance, version);
  }

  async sendMcpMessage(message: JSONRPCMessage) {
    if (this.#exiting) {
      console.warn('Attempted to send MCP message after container began exiting', message);
      return;
    }
    mcpTraceLog('send-mcp', {
      id: 'id' in message ? (message as any).id : undefined,
      method: 'method' in message ? message.method : undefined
    });

    this.#stream.write({
      stdin: Buffer.from(JSON.stringify(message) + '\n', 'utf-8')
    });
  }

  waitForInitialization() {
    return this.#initPromise.promise;
  }

  #isTerminating = false;
  async terminate() {
    if (this.#isTerminating) return;
    this.#isTerminating = true;
    mcpTraceLog('terminate:start');

    try {
      this.#stream.write({
        terminate: { timeoutSecs: 5, force: true }
      });
    } catch (e) {
      Sentry.captureException(e);
    }

    setTimeout(() => this.cleanup(), CLEANUP_TIMEOUT_MS);
  }

  private async init() {
    mcpTraceLog('init:start');
    let version = this.version;
    let repository = this.version.repository;
    let registry = repository.registry;

    let auth = registry.secretOid
      ? await secretService.DANGEROUSLY_decryptSecret({
          secretOid: registry.secretOid,
          purpose: 'registry_credentials',
          tenant: this.tenant
        })
      : undefined;
    let { transformed: config } = await secretService.DANGEROUSLY_decryptSecret({
      secretOid: this.serverConfig.secretOid,
      purpose: 'server_config_value',
      tenant: this.tenant
    });

    let rules = await networkingRulesetService.getRulesetForConnection({
      connection: this.connection
    });
    mcpTraceLog('init:config-loaded', {
      hasRegistryAuth: !!auth,
      rulesCount: rules.rules.length
    });

    this.#lastMessageAt = Date.now();

    this.#holopodPingIv = setInterval(async () => {
      try {
        this.#stream.write({ heartbeat: true });

        await this.sendMcpMessage({
          jsonrpc: '2.0',
          method: 'ping',
          id: `${PING_ID_PREFIX}${generatePlainId(10)}`,
          params: {}
        });

        if (Date.now() - this.#lastMessageAt > 45 * 1000) {
          mcpTraceLog('heartbeat:stale', {
            lastMessageAt: this.#lastMessageAt
          });
          this.logger.log(
            'debug.warning',
            `No ping response received from MCP servers. Terminating connection.`
          );
          this.terminate();
        }

        if (isDev) {
          console.log('Sent Holopod heartbeat');
        }
      } catch (e) {
        Sentry.captureException(e);
      }
    }, 10 * 1000);

    this.#stream.on('data', (d: RunResponse) => this.handleRunResponse(d));

    this.#stream.on('error', async err => {
      mcpTraceLog('stream:error', err);
      this.terminate();
    });

    this.#stream.on('end', async () => {
      mcpTraceLog('stream:end');
      if (isDev) {
        console.log('Holopod stream ended');
      }

      if (this.#holopodPingIv) {
        clearInterval(this.#holopodPingIv);
        this.#holopodPingIv = null;
      }

      this.terminate();
    });

    this.#stream.write({
      create: {
        config: {
          imageSpec: {
            registry: registry.url,
            image: `${repository.name}@${version.digest}`,
            basicAuth: auth ? { username: auth.username, password: auth.password } : undefined
          },

          command: config.command ?? [],
          args: config.args ?? [],
          env: config.env ?? {},

          network: {
            defaultPolicy: rules.defaultAction == 'accept' ? 'allow' : 'deny',
            dnsServers: getHolopodDnsServers(),
            rules: rules.rules.map(r => ({
              action: r.action == 'accept' ? 'allow' : 'deny',
              protocol: r.protocol,
              destination: r.destination,
              portRangeStart: r.portRange?.start,
              portRangeEnd:
                r.portRange?.start == r.portRange?.end ? undefined : r.portRange?.end
            }))
          }
        }
      }
    });
    mcpTraceLog('init:create-sent', {
      image: `${repository.name}@${version.digest}`
    });
  }

  private async handleRunResponse(d: RunResponse) {
    mcpTraceLog('run-response:enqueue', {
      hasCreated: !!d.created,
      hasError: !!d.error,
      hasExit: !!d.exit,
      hasStdout: !!d.stdout,
      hasStderr: !!d.stderr,
      hasMessage: !!d.message
    });
    this.#processingQueue.add(async () => {
      if (d.created) return await this.handleRunResponse_created(d.created);
      if (d.error) return await this.handleRunResponse_error(d.error);
      if (d.exit) return await this.handleRunResponse_exit(d.exit);
      if (d.stderr) return await this.handleRunResponse_stderr(d.stderr);
      if (d.stdout) return await this.handleRunResponse_stdout(d.stdout);
      if (d.message) return await this.handleRunResponse_message(d.message);
      console.warn('Unhandled RunResponse:', d);
    });
  }

  private async handleRunResponse_created(d: RunResponse['created']) {
    mcpTraceLog('run-response:created', d);
    // message.container_ready is much more interesting than created
  }

  private async handleRunResponse_error(d: RunResponse['error']) {
    mcpTraceLog('run-response:error', d);
    console.error('Holopod error:', d ?? 'Unknown error');

    this.handleOutput('debug.error', `Holopod error: ${d ?? 'Unknown error'}`, new Date());
    this.messenger.sendToListeners({
      type: 'error',
      data: {
        code: 'container_error',
        message: d ?? 'Unknown error'
      }
    });

    setTimeout(() => this.cleanup(), CLEANUP_TIMEOUT_MS);
  }

  private async handleRunResponse_exit(d: RunResponse['exit']) {
    mcpTraceLog('run-response:exit', d);
    this.containerExited();
  }

  private async handleRunResponse_stderr(d: RunResponse['stderr']) {
    if (!d) return;
    let data = d.toString('utf-8');
    mcpTraceLog('run-response:stderr', { bytes: d.length });

    this.handleOutput('stderr', data, new Date());
  }

  private async handleRunResponse_stdout(d: RunResponse['stdout']) {
    if (!d) return;
    let data = d.toString('utf-8');
    mcpTraceLog('run-response:stdout', { bytes: d.length });

    let mcpMessage = safeParse(data) as JSONRPCMessage | undefined;
    if (mcpMessage) {
      this.#lastMessageAt = Date.now();

      let id = 'id' in mcpMessage && mcpMessage.id ? mcpMessage.id : null;

      if (typeof id == 'string' && id.startsWith(PING_ID_PREFIX)) return;

      if ('method' in mcpMessage && mcpMessage.method === 'ping') {
        mcpTraceLog('run-response:ping-request', { id });
        await this.sendMcpMessage({
          jsonrpc: '2.0',
          id: id!,
          result: {}
        });
        return;
      }

      await this.messenger.sendToListeners({ type: 'mcp.message', data: mcpMessage });
      mcpTraceLog('run-response:mcp-dispatched', {
        id: 'id' in mcpMessage ? (mcpMessage as any).id : undefined,
        method: 'method' in mcpMessage ? (mcpMessage as any).method : undefined
      });
    } else {
      this.handleOutput('stdout', data, new Date());
    }
  }

  private async handleRunResponse_message(d: RunResponse['message']) {
    mcpTraceLog('run-response:message-raw', d);
    let data = safeParse(d!) as
      | {
          type: string;
          message?: string;
          data?: Record<string, any>;
          timestamp: string | number | Date;
        }
      | undefined;
    if (!data) return;

    switch (data.type as string) {
      case 'info':
      case 'warning':
      case 'error':
        this.handleOutput(
          `debug.${data.type as 'info' | 'warning' | 'error'}`,
          data.message ?? '',
          data.timestamp
        );
        break;

      case 'container_ready':
        mcpTraceLog('event:container_ready');
        await this.containerReady();
        break;

      case 'container_terminating':
        mcpTraceLog('event:container_terminating');
        this.#exiting = true;
        break;

      case 'container_exited':
        mcpTraceLog('event:container_exited');
        await this.containerExited();
        break;

      // case 'container_created':
      // case 'container_started':
      // case 'image_pull_started':
      // case 'image_pull_completed':
      // case 'container_ip_ready':
      // case 'network_isolation_ready':
    }
  }

  private async containerReady() {
    if (this.#initialized) return;
    this.#initialized = true;
    mcpTraceLog('container:ready');

    this.#initPromise.resolve();
  }

  private async containerExited() {
    if (this.#exited) return;
    this.#exited = true;
    this.#exiting = false;
    mcpTraceLog('container:exited');

    this.messenger.sendToListeners({ type: 'close' });

    setTimeout(() => this.cleanup(), CLEANUP_TIMEOUT_MS);
  }

  private async cleanup() {
    mcpTraceLog('cleanup:start');
    try {
      this.#stream.end();
    } catch (e) {
      Sentry.captureException(e);
    }

    try {
      this.#grpcClient.close();
    } catch (e) {
      Sentry.captureException(e);
    }

    this.#processingQueue.clear();

    if (this.#holopodPingIv) {
      clearInterval(this.#holopodPingIv);
      this.#holopodPingIv = null;
    }

    await this.manager.close();
    await this.messenger.cleanup();
    await this.logger.flush();
    mcpTraceLog('cleanup:done');
  }

  private async handleOutput(
    type: PrismaJson.OutputType,
    data: string,
    timestamp: string | number | Date
  ) {
    if (isDev) {
      console.log(`[Holopod][${type}]`, data);
    }

    this.logger.log(type, data, timestamp);
  }
}
