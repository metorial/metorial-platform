import { forbiddenError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import {
  type Enclave,
  type Environment,
  db,
  type Session,
  type Solution,
  type Tenant
} from '@metorial-subspace/db';
import { isIpAllowedByIngressAllowList } from '../lib/ingressAllowList';
import { recordIngressNetworkLog } from '../lib/ingressNetworkLogBuffer';
import { enclaveService } from './enclave';

type SessionWithProviders = Session & {
  providers: {
    deployment: {
      enclave: Enclave | null;
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

let dedupeEnclaves = (enclaves: (Enclave | null)[]) => {
  let seen = new Set<bigint>();
  let result: Enclave[] = [];

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

class enclaveIngressPolicyServiceImpl {
  private async resolveSessions(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    sessionIds: string[];
  }) {
    let sessions = await db.session.findMany({
      where: {
        id: { in: d.sessionIds },
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
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
        solutionOid: d.solution.oid,
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

  async checkSessionIngressAccess(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    sessionIds: string[];
    sourceIp: string;
    hostname?: string | null;
    port?: number | null;
    recordLog?: boolean;
  }): Promise<{
    object: 'enclave.ingress_check';
    results: EnclaveIngressCheckResult[];
  }> {
    let sessionIds = Array.from(new Set(d.sessionIds));
    let sessionsByRequestedId = await this.resolveSessions({ ...d, sessionIds });

    let results: EnclaveIngressCheckResult[] = [];
    let logRecords: {
      enclave: Enclave;
      sessionId: string;
      result: 'allowed' | 'denied';
    }[] = [];

    for (let sessionId of sessionIds) {
      let session = sessionsByRequestedId.get(sessionId);
      if (!session) {
        results.push({
          sessionId,
          allowed: false,
          enclaveIds: [],
          deniedEnclaveIds: []
        });
        continue;
      }

      let enclaves = dedupeEnclaves(
        session.providers.map(provider => provider.deployment.enclave)
      );
      let deniedEnclaves: Enclave[] = [];

      for (let enclave of enclaves) {
        let compiledNetworkRules = await enclaveService.getCompiledNetworkRules({
          tenant: d.tenant,
          environment: d.environment,
          enclave
        });

        let allowed = isIpAllowedByIngressAllowList({
          sourceIp: d.sourceIp,
          ingressPolicy: compiledNetworkRules.ingress
        });

        if (!allowed) deniedEnclaves.push(enclave);
      }

      let allowed = deniedEnclaves.length === 0;
      results.push({
        sessionId,
        resolvedSessionId: session.id,
        allowed,
        enclaveIds: enclaves.map(enclave => enclave.id),
        deniedEnclaveIds: deniedEnclaves.map(enclave => enclave.id)
      });

      for (let enclave of enclaves) {
        logRecords.push({
          enclave,
          sessionId: session.id,
          result: deniedEnclaves.some(e => e.oid === enclave.oid) ? 'denied' : 'allowed'
        });
      }
    }

    if (d.recordLog && logRecords.length > 0) {
      for (let record of logRecords) {
        recordIngressNetworkLog({
          tenantOid: d.tenant.oid,
          environmentOid: d.environment.oid,
          solutionOid: d.solution.oid,
          enclaveOid: record.enclave.oid,
          sessionId: record.sessionId,
          sourceIp: d.sourceIp,
          hostname: d.hostname ?? 'unknown',
          port: d.port ?? 0,
          result: record.result
        });
      }
    }

    return {
      object: 'enclave.ingress_check',
      results
    };
  }

  async assertSessionIngressAccess(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    sessionId: string;
    sourceIp: string;
    hostname?: string | null;
    port?: number | null;
    recordLog?: boolean;
  }) {
    let check = await this.checkSessionIngressAccess({
      ...d,
      sessionIds: [d.sessionId]
    });

    let result = check.results[0];
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
}

export let enclaveIngressPolicyService = Service.create(
  'enclaveIngressPolicyService',
  () => new enclaveIngressPolicyServiceImpl()
).build();
