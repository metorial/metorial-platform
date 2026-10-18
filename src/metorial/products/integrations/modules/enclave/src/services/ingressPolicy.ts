import { createLocallyCachedFunction } from '@lowerdeck/cache';
import { forbiddenError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import {
  type IntegrationEnclave,
  type Environment,
  db,
  type Session,
  type Tenant
} from '@metorial-subspace/db';
import {
  getMetorialSolution,
  type MetorialFacing,
  resolveMetorialFacing
} from '@metorial-subspace/module-tenant';
import { isIpAllowedByIngressAllowList } from '../lib/ingressAllowList';
import { recordIngressNetworkLog } from '../lib/ingressNetworkLogBuffer';
import { integrationEnclaveService } from './integrationEnclave';

let SESSION_ENCLAVE_CACHE_TTL_SECONDS = 60;

type SessionWithProviders = Session & {
  providers: {
    deployment: {
      enclave: IntegrationEnclave | null;
    };
  }[];
};

export type EnclaveIngressCheckResult = {
  sessionId: string;
  resolvedSessionId?: string;
  allowed: boolean;
  enclaveIds: string[];
  deniedEnclaveIds: string[];
};

type CheckSessionIngressAccessParams = {
  sessionIds: string[];
  sourceIp: string;
  hostname?: string | null;
  port?: number | null;
  recordLog?: boolean;
};

type AssertSessionIngressAccessParams = {
  sessionId: string;
  session?: Pick<Session, 'oid' | 'id' | 'status'>;
  sourceIp: string;
  hostname?: string | null;
  port?: number | null;
  recordLog?: boolean;
};

let dedupeEnclaves = (enclaves: (IntegrationEnclave | null)[]) => {
  let seen = new Set<bigint>();
  let result: IntegrationEnclave[] = [];

  for (let enclave of enclaves) {
    if (!enclave) continue;
    if (seen.has(enclave.oid)) continue;
    seen.add(enclave.oid);
    result.push(enclave);
  }

  return result;
};

let sessionInclude = {
  providers: {
    where: { status: 'active' as const },
    include: {
      deployment: {
        include: {
          enclave: true
        }
      }
    }
  }
};

type SessionEnclaveRules = {
  enclave: IntegrationEnclave;
  ingressPolicy: PrismaJson.CompiledNetworkRules['ingress'];
};

let compileEnclaveRules = async (d: {
  tenant: Tenant;
  environment: Environment;
  enclaves: IntegrationEnclave[];
}): Promise<SessionEnclaveRules[]> =>
  await Promise.all(
    d.enclaves.map(async enclave => {
      let compiledNetworkRules =
        await integrationEnclaveService.getCompiledNetworkRulesInternal({
          tenant: d.tenant,
          environment: d.environment,
          enclave
        });

      return { enclave, ingressPolicy: compiledNetworkRules.ingress };
    })
  );

let getSessionEnclaveRules = createLocallyCachedFunction({
  ttlSeconds: SESSION_ENCLAVE_CACHE_TTL_SECONDS,
  getHash: (d: { tenant: Tenant; environment: Environment; sessionOid: bigint }) =>
    d.sessionOid.toString(),
  provider: async (d: {
    tenant: Tenant;
    environment: Environment;
    sessionOid: bigint;
  }): Promise<SessionEnclaveRules[]> => {
    let sessionProviders = await db.sessionProvider.findMany({
      where: {
        sessionOid: d.sessionOid,
        status: 'active'
      },
      select: {
        deployment: {
          select: { enclave: true }
        }
      }
    });

    return await compileEnclaveRules({
      tenant: d.tenant,
      environment: d.environment,
      enclaves: dedupeEnclaves(sessionProviders.map(provider => provider.deployment.enclave))
    });
  }
});

type IngressLogRecord = {
  enclave: IntegrationEnclave;
  sessionId: string;
  result: 'allowed' | 'denied';
};

let deniedMissingSessionResult = (sessionId: string): EnclaveIngressCheckResult => ({
  sessionId,
  allowed: false,
  enclaveIds: [],
  deniedEnclaveIds: []
});

let evaluateIngress = (d: {
  sessionId: string;
  session: Pick<Session, 'id'>;
  sourceIp: string;
  enclaveRules: SessionEnclaveRules[];
}) => {
  let deniedEnclaves = d.enclaveRules
    .filter(
      rule =>
        !isIpAllowedByIngressAllowList({
          sourceIp: d.sourceIp,
          ingressPolicy: rule.ingressPolicy
        })
    )
    .map(rule => rule.enclave);
  let deniedEnclaveOids = new Set(deniedEnclaves.map(enclave => enclave.oid));

  let result: EnclaveIngressCheckResult = {
    sessionId: d.sessionId,
    resolvedSessionId: d.session.id,
    allowed: deniedEnclaves.length === 0,
    enclaveIds: d.enclaveRules.map(rule => rule.enclave.id),
    deniedEnclaveIds: deniedEnclaves.map(enclave => enclave.id)
  };

  let logRecords: IngressLogRecord[] = d.enclaveRules.map(rule => ({
    enclave: rule.enclave,
    sessionId: d.session.id,
    result: deniedEnclaveOids.has(rule.enclave.oid) ? 'denied' : 'allowed'
  }));

  return { result, logRecords };
};

class enclaveIngressPolicyServiceImpl {
  private async resolveSessions(d: {
    tenant: Tenant;
    environment: Environment;
    sessionIds: string[];
  }) {
    let solution = await getMetorialSolution();

    let sessions = await db.session.findMany({
      where: {
        id: { in: d.sessionIds },
        tenantOid: d.tenant.oid,
        solutionOid: solution.oid,
        environmentOid: d.environment.oid,
        status: 'active'
      },
      include: sessionInclude
    });

    let sessionsByRequestedId = new Map<string, SessionWithProviders>();
    for (let session of sessions) {
      sessionsByRequestedId.set(session.id, session as SessionWithProviders);
    }

    let missingSessionIds = d.sessionIds.filter(id => !sessionsByRequestedId.has(id));
    if (missingSessionIds.length === 0) return sessionsByRequestedId;

    let ephemeralManagedSessions = await db.ephemeralManagedSession.findMany({
      where: {
        id: { in: missingSessionIds },
        tenantOid: d.tenant.oid,
        solutionOid: solution.oid,
        environmentOid: d.environment.oid,
        status: 'active'
      },
      include: {
        currentSession: {
          include: sessionInclude
        }
      }
    });

    for (let ephemeralManagedSession of ephemeralManagedSessions) {
      if (!ephemeralManagedSession.currentSession) continue;
      sessionsByRequestedId.set(
        ephemeralManagedSession.id,
        ephemeralManagedSession.currentSession as SessionWithProviders
      );
    }

    return sessionsByRequestedId;
  }

  async checkSessionIngressAccess(d: MetorialFacing<CheckSessionIngressAccessParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.checkSessionIngressAccessInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async checkSessionIngressAccessInternal(
    d: { tenant: Tenant; environment: Environment } & CheckSessionIngressAccessParams
  ): Promise<{
    object: 'enclave.ingress_check';
    results: EnclaveIngressCheckResult[];
  }> {
    let sessionIds = Array.from(new Set(d.sessionIds));
    let sessionsByRequestedId = await this.resolveSessions({ ...d, sessionIds });

    let results: EnclaveIngressCheckResult[] = [];
    let logRecords: IngressLogRecord[] = [];

    for (let sessionId of sessionIds) {
      let session = sessionsByRequestedId.get(sessionId);
      if (!session) {
        results.push(deniedMissingSessionResult(sessionId));
        continue;
      }

      let enclaveRules = await compileEnclaveRules({
        tenant: d.tenant,
        environment: d.environment,
        enclaves: dedupeEnclaves(
          session.providers.map(provider => provider.deployment.enclave)
        )
      });

      let evaluation = evaluateIngress({
        sessionId,
        session,
        sourceIp: d.sourceIp,
        enclaveRules
      });
      results.push(evaluation.result);
      logRecords.push(...evaluation.logRecords);
    }

    if (d.recordLog) await this.recordLogs({ ...d, logRecords });

    return {
      object: 'enclave.ingress_check',
      results
    };
  }

  async assertSessionIngressAccess(d: MetorialFacing<AssertSessionIngressAccessParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.assertSessionIngressAccessInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async assertSessionIngressAccessInternal(
    d: { tenant: Tenant; environment: Environment } & AssertSessionIngressAccessParams
  ) {
    let result = d.session
      ? await this.checkResolvedSessionIngressAccess({ ...d, session: d.session })
      : (
          await this.checkSessionIngressAccessInternal({
            ...d,
            sessionIds: [d.sessionId]
          })
        ).results[0];

    if (!result?.allowed) {
      throw new ServiceError(
        forbiddenError({
          message: 'Ingress network policy blocked this connection',
          code: 'ingress_network_policy_blocked'
        })
      );
    }

    return result;
  }

  private async checkResolvedSessionIngressAccess(
    d: { tenant: Tenant; environment: Environment } & AssertSessionIngressAccessParams & {
        session: Pick<Session, 'oid' | 'id' | 'status'>;
      }
  ) {
    if (d.session.status !== 'active') return deniedMissingSessionResult(d.sessionId);

    let enclaveRules = await getSessionEnclaveRules({
      tenant: d.tenant,
      environment: d.environment,
      sessionOid: d.session.oid
    });

    let evaluation = evaluateIngress({
      sessionId: d.sessionId,
      session: d.session,
      sourceIp: d.sourceIp,
      enclaveRules
    });

    if (d.recordLog) await this.recordLogs({ ...d, logRecords: evaluation.logRecords });

    return evaluation.result;
  }

  private async recordLogs(d: {
    tenant: Tenant;
    environment: Environment;
    sourceIp: string;
    hostname?: string | null;
    port?: number | null;
    logRecords: IngressLogRecord[];
  }) {
    if (d.logRecords.length === 0) return;

    let solution = await getMetorialSolution();

    for (let record of d.logRecords) {
      recordIngressNetworkLog({
        tenantOid: d.tenant.oid,
        projectOid: d.tenant.projectOid,
        environmentOid: d.environment.oid,
        instanceOid: d.environment.instanceOid,
        solutionOid: solution.oid,
        enclaveOid: record.enclave.oid,
        sessionId: record.sessionId,
        sourceIp: d.sourceIp,
        hostname: d.hostname ?? 'unknown',
        port: d.port ?? 0,
        result: record.result
      });
    }
  }
}

export let enclaveIngressPolicyService = Service.create(
  'enclaveIngressPolicyService',
  () => new enclaveIngressPolicyServiceImpl()
).build();
