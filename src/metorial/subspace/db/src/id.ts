import { createIdGenerator, idType } from '@lowerdeck/id';
import { Snowflake } from '@lowerdeck/snowflake';
import { randomUUID } from 'crypto';
import os from 'os';
import Redis from 'ioredis';

export let ID = createIdGenerator({
  tenant: idType.sorted('ktn'),
  solution: idType.sorted('kso'),
  environment: idType.sorted('ken'),
  backend: idType.sorted('kbe'),
  brand: idType.sorted('kbr'),
  tenantActor: idType.sorted('pact'),
  tenantOAuthCallbackUrl: idType.sorted('cbu'),

  publisher: idType.sorted('pub'),

  providerVariant: idType.sorted('pvr'),
  provider: idType.sorted('pro'),
  providerEntry: idType.sorted('pre'),
  providerVersion: idType.sorted('prv'),
  providerType: idType.sorted('pty'),

  providerListing: idType.sorted('plg'),
  providerListingUpdate: idType.sorted('plu'),
  providerCategory: idType.sorted('pca'),
  providerCollection: idType.sorted('pco'),
  providerGroup: idType.sorted('pgr'),

  environmentProvider: idType.sorted('kep'),

  providerEnvironment: idType.sorted('pen'),
  providerEnvironmentVersion: idType.sorted('pev'),

  providerDeployment: idType.sorted('pde'),
  providerDeploymentVersion: idType.sorted('pdv'),

  enclave: idType.sorted('enc'),
  enclaveEnvironment: idType.sorted('een'),
  network: idType.sorted('net'),
  firewall: idType.sorted('fwl'),
  firewallBinding: idType.sorted('fwb'),
  networkPolicy: idType.sorted('npo'),
  networkPolicyRule: idType.sorted('npr'),
  networkPolicyVersion: idType.sorted('npv'),
  firewallNetworkPolicy: idType.sorted('fwn'),
  enclaveIngressNetworkLog: idType.sorted('einl'),
  slateInstanceConfiguration: idType.sorted('sicf'),
  serverInstanceConfiguration: idType.sorted('shic'),

  providerConfig: idType.sorted('pcf'),
  providerConfigVersion: idType.sorted('pcv'),
  providerConfigUpdate: idType.sorted('pcu'),
  providerConfigVault: idType.sorted('pcvt'),

  providerDeploymentConfigPair: idType.sorted('pdcp'),
  providerDeploymentConfigPairProviderVersion: idType.sorted('pdcpv'),

  providerVersionSpecificationChange: idType.sorted('pvsc'),
  providerSpecificationChangeNotification: idType.sorted('pscn'),
  providerDeploymentConfigPairSpecificationChange: idType.sorted('pdcpsc'),
  providerDeploymentConfigPairDiscovery: idType.sorted('pdcpd'),

  providerUse: idType.sorted('pus'),
  providerTag: idType.sorted('kpt'),

  providerSpecification: idType.sorted('psp'),
  providerTool: idType.sorted('pto'),
  providerToolGlobal: idType.sorted('ptog'),
  providerAuthMethod: idType.sorted('pam'),
  providerAuthMethodGlobal: idType.sorted('pamg'),
  providerTrigger: idType.sorted('ptr'),
  providerTriggerGlobal: idType.sorted('ptrg'),

  providerAuthCredentials: idType.sorted('par'),
  managedProviderAuthCredentials: idType.sorted('pmac'),
  providerAuthConfig: idType.sorted('pac'),
  providerAuthConfigVersion: idType.sorted('pacv'),
  providerAuthConfigEvent: idType.sorted('pacev'),
  providerAuthConfigError: idType.sorted('paerr'),
  providerAuthConfigErrorGlobal: idType.sorted('paerg'),
  providerOAuthSetup: idType.sorted('poas'),
  providerOAuthSetup_clientSecret: idType.key('poas_secret'),
  providerAuthConfigUpdate: idType.sorted('pacu'),
  providerSetupSession: idType.sorted('pas'),
  providerSetupSession_clientSecret: idType.key('pas_secret'),
  providerSetupSessionEvent: idType.sorted('pase'),

  providerAuthImport: idType.sorted('paci'),
  providerAuthExport: idType.sorted('pace'),

  providerAuthConfigUsedForConfig: idType.sorted('pacufc'),
  providerAuthConfigUsedForDeployment: idType.sorted('pacufd'),

  customProvider: idType.sorted('cpr'),
  customProviderCommit: idType.sorted('cpc'),
  customProviderVersion: idType.sorted('cpv'),
  customProviderDeployment: idType.sorted('cpd'),
  customProviderEnvironment: idType.sorted('cpe'),
  customProviderEnvironmentVersion: idType.sorted('cpev'),
  upcomingCustomProvider: idType.sorted('ucp'),

  session: idType.sorted('ses'),
  ephemeralManagedSession: idType.sorted('ems'),
  sessionTemplate: idType.sorted('set'),
  sessionTemplateProvider: idType.sorted('stp'),
  sessionProvider: idType.sorted('spv'),
  sessionProviderInstance: idType.sorted('spi'),
  sessionMessage: idType.sorted('smg'),
  sessionMessage_mcp: idType.sorted('smg_mcp'),
  sessionParticipant: idType.sorted('spar'),
  sessionEvent: idType.sorted('sev'),
  sessionClientConnection: idType.sorted('scc'),
  sessionConnection: idType.sorted('scon'),
  sessionConnection_token: idType.unsorted('scon_tok', 30),
  sessionConnectionProviderSpecification: idType.sorted('sconps'),
  sessionError: idType.sorted('serr'),
  sessionErrorGroup: idType.sorted('serg'),
  sessionWarning: idType.sorted('swarn'),
  protoGuardFilter: idType.sorted('pgf'),
  protoGuardTenantSetting: idType.sorted('pgts'),
  protoGuardTenantFilterSetting: idType.sorted('pgtf'),
  protoGuardRun: idType.sorted('pgrn'),
  protoGuardAlert: idType.sorted('pga'),
  protoGuardAlertInstance: idType.sorted('pgai'),
  monitor: idType.sorted('mon'),
  monitorAlert: idType.sorted('mal'),
  monitorAlertEvent: idType.sorted('mae'),
  monitorAlertRecipient: idType.sorted('mar'),

  providerRun: idType.sorted('prun'),

  callbackDestination: idType.sorted('cbd'),
  callback: idType.sorted('cbk'),
  callbackInstance: idType.sorted('cbi'),
  callbackProviderTrigger: idType.sorted('cbpt'),
  callbackReceiverRegistration: idType.sorted('cbrr'),

  toolCall: idType.sorted('tcl'),
  toolCallAttachment: idType.sorted('tca'),

  identityActor: idType.sorted('iac'),
  identity: idType.sorted('idn'),
  identityCredential: idType.sorted('icr'),
  identityCredentialVersion: idType.sorted('icrv'),
  identityDelegation: idType.sorted('ide'),
  identityDelegationRequest: idType.sorted('idr'),
  identityDelegationConfig: idType.sorted('idc'),
  identityDelegationConfigVersion: idType.sorted('idcv'),
  identityDelegationParty: idType.sorted('idp'),
  identityDelegationAttestation: idType.sorted('ida'),
  delegatedIdentity: idType.sorted('did'),
  delegatedIdentityCredential: idType.sorted('dcr'),
  delegatedIdentityUpdate: idType.sorted('diu'),
  delegatedIdentityUpdateCredential: idType.sorted('diuc'),
  identityDelegationCredentialOverride: idType.sorted('idco'),
  agent: idType.sorted('agt'),
  agentClient: idType.sorted('agc'),
  agentClientRegistration: idType.sorted('agr'),
  agentInstance: idType.sorted('agi'),

  integration: idType.sorted('int'),
  integrationInstanceGroup: idType.sorted('dii'),
  integrationInstanceGroupSource: idType.sorted('dis'),
  integrationInstanceGroupProvider: idType.sorted('dip'),
  integrationInstance: idType.sorted('ini'),
  integrationInstanceProvider: idType.sorted('iip'),
  integrationInstanceProviderVersion: idType.sorted('iiv'),
  integrationProvider: idType.sorted('inp'),
  magicMcpServerProvider: idType.sorted('msp'),
  integrationProviderVersion: idType.sorted('ipv'),
  integrationVersion: idType.sorted('inv'),
  integrationVersionProvider: idType.sorted('ivp'),
  integrationSetupSession: idType.sorted('iss'),
  integrationSetupSession_clientSecret: idType.key('iss_secret'),
  integrationSetupSessionProvider: idType.sorted('isp'),
  integrationSetupSessionStep: idType.sorted('isst'),
  integrationSetupSessionEvent: idType.sorted('ise'),

  skillEntity: idType.sorted('ske'),
  skill: idType.sorted('skl'),
  skillFork: idType.sorted('skf'),
  skillGroup: idType.sorted('skg'),
  skillGroupItem: idType.sorted('skgi'),
  skillTemplate: idType.sorted('skt'),
  skillTemplateItem: idType.sorted('skti'),
  skillItem: idType.sorted('ski'),
  skillIntegration: idType.sorted('skn'),
  skillProvider: idType.sorted('skp'),
  skillProviderLink: idType.sorted('skpl')
});

let workerIdBits = 12;
let workerIdMask = (1 << workerIdBits) - 1;
let sequenceBits = 9;
let epoch = new Date('2025-06-01T00:00:00Z');

let getRandomWorkerId = () => {
  let array = new Uint16Array(1);
  crypto.getRandomValues(array);
  return array[0]! & workerIdMask;
};

let createSnowflake = (workerId: number) =>
  new Snowflake({
    workerId,
    datacenterId: 0,
    workerIdBits: workerIdBits,
    datacenterIdBits: 0,
    sequenceBits,
    epoch
  });

export type SnowflakeGenerator = ReturnType<typeof createSnowflake>;
export type RedisLeaseClient = {
  set: (...args: any[]) => Promise<'OK' | null>;
  eval: (...args: any[]) => Promise<unknown>;
  quit: () => Promise<unknown>;
  disconnect: () => void;
};

export type SnowflakeWorkerLease = {
  workerId: number;
  ownerId: string;
  key: string;
  redis: RedisLeaseClient;
  generator: SnowflakeGenerator;
  renewInterval: ReturnType<typeof setInterval> | null;
  ownsRedisClient: boolean;
  released: boolean;
  renew: () => Promise<boolean>;
  release: () => Promise<void>;
};

export type InitializeSnowflakeWorkerLeaseOptions = {
  redisUrl?: string;
  redis?: RedisLeaseClient;
  ownerId?: string;
  keyPrefix?: string;
  ttlMs?: number;
  renewIntervalMs?: number;
  allowLocalFallback?: boolean;
  /** @deprecated Lease recovery no longer terminates the process. */
  fatal?: (error: Error) => void;
  startWorkerId?: number;
  autoRenew?: boolean;
};

let localSnowflake = createSnowflake(getRandomWorkerId());
let activeSnowflake: SnowflakeGenerator = localSnowflake;
let activeLease: SnowflakeWorkerLease | null = null;
let signalHandlersRegistered = false;

let shouldRequireLease = () =>
  process.env.NODE_ENV === 'production' || process.env.METORIAL_ENV === 'production';

let createRedisClient = (redisUrl: string): Redis => {
  let url = new URL(redisUrl);

  return new Redis({
    host: url.hostname,
    port: Number.parseInt(url.port || '6379', 10),
    username: url.username || undefined,
    password: url.password || undefined,
    db: Number.parseInt(url.pathname.slice(1) || '0', 10),
    tls: url.protocol === 'rediss:' ? { rejectUnauthorized: false } : undefined,
    retryStrategy: (times: number) => Math.min(times * 50, 3000),
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
    keepAlive: 30000
  });
};

let renewScript = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    redis.call("pexpire", KEYS[1], ARGV[2])
    return 1
  else
    return 0
  end
`;

let releaseScript = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  else
    return 0
  end
`;

let registerSignalHandlers = () => {
  if (signalHandlersRegistered) return;
  signalHandlersRegistered = true;

  let releaseAndExit = (signal: NodeJS.Signals) => {
    void releaseSnowflakeWorkerLease().finally(() => {
      process.exit(signal === 'SIGINT' ? 130 : 143);
    });
  };

  process.once('SIGTERM', releaseAndExit);
  process.once('SIGINT', releaseAndExit);
};

let claimWorkerId = async (d: {
  redis: RedisLeaseClient;
  keyPrefix: string;
  ownerId: string;
  ttlMs: number;
  startWorkerId?: number;
}) => {
  let start = d.startWorkerId ?? getRandomWorkerId();

  for (let offset = 0; offset <= workerIdMask; offset++) {
    let workerId = (start + offset) & workerIdMask;
    let key = `${d.keyPrefix}:${workerId}`;
    let result = await d.redis.set(key, d.ownerId, 'PX', d.ttlMs, 'NX');

    if (result === 'OK') return { workerId, key };
  }

  throw new Error('Unable to claim a Snowflake worker ID lease');
};

export let createSnowflakeWorkerLease = async (
  opts: InitializeSnowflakeWorkerLeaseOptions = {}
) => {
  if (!opts.redis && !opts.redisUrl) {
    throw new Error('REDIS_URL is required to initialize the Snowflake worker lease');
  }

  let redis = (opts.redis ?? createRedisClient(opts.redisUrl!)) as RedisLeaseClient;
  let ownsRedisClient = !opts.redis;
  let ownerId = opts.ownerId ?? `${os.hostname()}:${process.pid}:${randomUUID()}`;
  let keyPrefix = opts.keyPrefix ?? 'subspace:snowflake-worker';
  let ttlMs = opts.ttlMs ?? 30_000;
  let renewIntervalMs = opts.renewIntervalMs ?? Math.floor(ttlMs / 3);
  let autoRenew = opts.autoRenew ?? true;
  let claimed = await claimWorkerId({
    redis,
    keyPrefix,
    ownerId,
    ttlMs,
    startWorkerId: opts.startWorkerId
  });

  let generator = createSnowflake(claimed.workerId);

  let lease = {} as SnowflakeWorkerLease;
  let renewInFlight: Promise<boolean> | null = null;
  let restoreInFlight: Promise<void> | null = null;
  let deactivateLease = () => {
    lease.released = true;
    if (lease.renewInterval) clearInterval(lease.renewInterval);
    lease.renewInterval = null;
    if (activeLease === lease) {
      activeLease = null;
      activeSnowflake = localSnowflake;
    }
  };

  let restoreLease = async () => {
    if (lease.released) return;
    if (restoreInFlight) return restoreInFlight;

    restoreInFlight = (async () => {
      let restored = await claimWorkerId({
        redis,
        keyPrefix,
        ownerId,
        ttlMs,
        // Prefer to reclaim the worker ID whose generator remains active while
        // Redis is unavailable. If it has been taken, claim the next free ID.
        startWorkerId: lease.workerId
      });

      // Shutdown can race a successful claim. Do not leave that claim behind.
      if (lease.released) {
        await redis.eval(releaseScript, 1, restored.key, ownerId).catch(() => {});
        return;
      }

      if (restored.workerId !== lease.workerId) {
        lease.generator = createSnowflake(restored.workerId);
      }
      lease.workerId = restored.workerId;
      lease.key = restored.key;

      if (activeLease === lease) activeSnowflake = lease.generator;
    })().finally(() => {
      restoreInFlight = null;
    });

    return restoreInFlight;
  };

  lease = {
    workerId: claimed.workerId,
    ownerId,
    key: claimed.key,
    redis,
    generator,
    ownsRedisClient,
    released: false,
    renewInterval: null,
    renew: async () => {
      // Shutdown can race an in-flight renew (key deleted / redis closed).
      // Treat that as a successful no-op so we don't fatal during clean exit.
      if (lease.released) return true;
      if (renewInFlight) return renewInFlight;

      renewInFlight = (async () => {
        try {
          if (lease.released) return true;

          let result = await redis.eval(renewScript, 1, lease.key, ownerId, String(ttlMs));
          if (lease.released) return true;

          return Number(result) === 1;
        } finally {
          renewInFlight = null;
        }
      })();

      return renewInFlight;
    },
    release: async () => {
      if (lease.released) return;

      deactivateLease();

      try {
        await redis.eval(releaseScript, 1, lease.key, ownerId);
      } finally {
        if (ownsRedisClient) {
          await redis.quit().catch(() => redis.disconnect());
        }
      }
    }
  };

  if (autoRenew) {
    lease.renewInterval = setInterval(() => {
      void lease
        .renew()
        .then(renewed => {
          if (lease.released || renewed) return;

          return restoreLease();
        })
        // Redis errors are expected during a connection loss. Keep using the
        // current worker ID optimistically; the next interval retries renewal
        // or restoration without taking ID generation down with Redis.
        .catch(() => {});
    }, renewIntervalMs);

    (lease.renewInterval as any).unref?.();
  }

  return lease;
};

export let initializeSnowflakeWorkerLease = async (
  opts: InitializeSnowflakeWorkerLeaseOptions = {}
) => {
  if (activeLease) {
    return {
      workerId: activeLease.workerId,
      ownerId: activeLease.ownerId,
      key: activeLease.key
    };
  }

  let allowLocalFallback = opts.allowLocalFallback ?? !shouldRequireLease();
  if (!opts.redis && !opts.redisUrl) {
    if (allowLocalFallback) {
      activeSnowflake = localSnowflake;
      return null;
    }

    throw new Error('REDIS_URL is required to initialize the Snowflake worker lease');
  }

  let lease = await createSnowflakeWorkerLease(opts);

  activeSnowflake = lease.generator;
  activeLease = lease;
  registerSignalHandlers();

  return {
    workerId: lease.workerId,
    ownerId: lease.ownerId,
    key: lease.key
  };
};

export let releaseSnowflakeWorkerLease = async () => {
  if (!activeLease || activeLease.released) return;
  await activeLease.release();
};

export let snowflake = {
  nextId: () => activeSnowflake.nextId()
};

export let getId = <K extends Parameters<typeof ID.generateIdSync>[0]>(model: K) => ({
  oid: snowflake.nextId(),
  id: ID.generateIdSync(model)
});

export let get4ByteIntId = (): number => {
  let buffer = new Int32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0]!;
};
