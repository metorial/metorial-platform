import { forbiddenError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import {
  type Enclave,
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

type CheckSessionIngressAccessParams = {
  sessionIds: string[];
  sourceIp: string;
  hostname?: string | null;
  port?: number | null;
  recordLog?: boolean;
};

type AssertSessionIngressAccessParams = {
  sessionId: string;
  sourceIp: string;
  hostname?: string | null;
  port?: number | null;
  recordLog?: boolean;
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
    let solution = await getMetorialSolution();
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
        let compiledNetworkRules = await enclaveService.getCompiledNetworkRulesInternal({
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
    let check = await this.checkSessionIngressAccessInternal({
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
