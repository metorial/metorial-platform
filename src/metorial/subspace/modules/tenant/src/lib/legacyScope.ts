import { db as subspaceDb } from '@metorial-subspace/db';
import { metorialDb } from './metorialDb';

export let CANONICAL_TENANT_PREFIX = 'mte-pro-';
export let CANONICAL_ENVIRONMENT_PREFIX = 'mte-ins-';

let LEGACY_TENANT_INSTANCE_PREFIX = 'mte-';
let LEGACY_TENANT_ORGANIZATION_PREFIX = 'mteo-';
let LEGACY_ENVIRONMENT_INSTANCE_PREFIX = 'mtei-';

let METORIAL_INSTANCE_ID_PREFIX = 'ins_';
let METORIAL_ORGANIZATION_ID_PREFIX = 'org_';

export let isCanonicalProjectIdentifier = (identifier: string | null | undefined) =>
  identifier?.startsWith(CANONICAL_TENANT_PREFIX) ?? false;

export let isCanonicalEnvironmentIdentifier = (identifier: string | null | undefined) =>
  identifier?.startsWith(CANONICAL_ENVIRONMENT_PREFIX) ?? false;

let parseOid = (identifier: string | null | undefined, prefix: string) => {
  if (!identifier?.startsWith(prefix)) return null;

  let raw = identifier.slice(prefix.length);
  if (!/^[0-9]+$/.test(raw)) return null;

  return BigInt(raw);
};

export let parseCanonicalProjectOid = (identifier: string | null | undefined) =>
  parseOid(identifier, CANONICAL_TENANT_PREFIX);

export let parseCanonicalInstanceOid = (identifier: string | null | undefined) =>
  parseOid(identifier, CANONICAL_ENVIRONMENT_PREFIX);

/**
 * Legacy identifiers embed the Metorial string id rather than the oid, and use an underscore
 * where the canonical identifiers use a dash: `mte-ins_0mlz...` is a legacy per-instance tenant,
 * `mte-ins-48526066661381120` is a canonical environment.
 */
let parseLegacyMetorialId = (
  identifier: string | null | undefined,
  prefix: string,
  idPrefix: string
) => {
  if (!identifier?.startsWith(prefix)) return null;

  let raw = identifier.slice(prefix.length);
  return raw.startsWith(idPrefix) ? raw : null;
};

export let parseLegacyTenantInstanceId = (identifier: string | null | undefined) =>
  parseLegacyMetorialId(
    identifier,
    LEGACY_TENANT_INSTANCE_PREFIX,
    METORIAL_INSTANCE_ID_PREFIX
  );

export let parseLegacyTenantOrganizationId = (identifier: string | null | undefined) =>
  parseLegacyMetorialId(
    identifier,
    LEGACY_TENANT_ORGANIZATION_PREFIX,
    METORIAL_ORGANIZATION_ID_PREFIX
  );

export let parseLegacyEnvironmentInstanceId = (identifier: string | null | undefined) =>
  parseLegacyMetorialId(
    identifier,
    LEGACY_ENVIRONMENT_INSTANCE_PREFIX,
    METORIAL_INSTANCE_ID_PREFIX
  );

export type ScopeResolution<T> =
  | { status: 'resolved'; value: T; source: string }
  | { status: 'unresolved'; reason: string };

export type LegacyEnvironmentCandidate = {
  id: string;
  identifier: string;
  resourceGroupIdentifier: string | null;
  instanceOid: bigint | null;
};

export type LegacyTenantCandidate = {
  id: string;
  identifier: string;
  resourceTenantIdentifier: string | null;
  projectOid: bigint | null;
};

export type ResolvedInstance = {
  oid: bigint;
  projectOid: bigint;
};

let loadInstance = async (where: { oid: bigint } | { id: string }) =>
  await metorialDb.instance.findUnique({
    where: where as any,
    select: { oid: true, projectOid: true }
  });

export let resolveInstanceForEnvironment = async (
  environment: LegacyEnvironmentCandidate
): Promise<ScopeResolution<ResolvedInstance>> => {
  if (environment.instanceOid !== null) {
    let instance = await loadInstance({ oid: environment.instanceOid });
    if (instance) return { status: 'resolved', value: instance, source: 'mirrorInstanceOid' };
  }

  let linked = await metorialDb.instance.findFirst({
    where: { subspaceEnvironmentId: environment.id },
    select: { oid: true, projectOid: true }
  });
  if (linked) return { status: 'resolved', value: linked, source: 'subspaceEnvironmentId' };

  let legacyInstanceId = parseLegacyEnvironmentInstanceId(environment.identifier);
  if (legacyInstanceId) {
    let instance = await loadInstance({ id: legacyInstanceId });
    if (instance) return { status: 'resolved', value: instance, source: 'legacyIdentifier' };
  }

  let canonicalOid =
    parseCanonicalInstanceOid(environment.identifier) ??
    parseCanonicalInstanceOid(environment.resourceGroupIdentifier);
  if (canonicalOid !== null) {
    let instance = await loadInstance({ oid: canonicalOid });
    if (instance) {
      return { status: 'resolved', value: instance, source: 'canonicalIdentifier' };
    }
  }

  return {
    status: 'unresolved',
    reason: `No Metorial instance resolves for subspace environment ${environment.id} (${environment.identifier})`
  };
};

let projectExists = async (projectOid: bigint) =>
  !!(await metorialDb.project.findUnique({
    where: { oid: projectOid },
    select: { oid: true }
  }));

export let resolveProjectForTenant = async (
  tenant: LegacyTenantCandidate
): Promise<ScopeResolution<bigint>> => {
  if (tenant.projectOid !== null && (await projectExists(tenant.projectOid))) {
    return { status: 'resolved', value: tenant.projectOid, source: 'mirrorProjectOid' };
  }

  let linked = await metorialDb.project.findFirst({
    where: { subspaceTenantId: tenant.id },
    select: { oid: true }
  });
  if (linked) return { status: 'resolved', value: linked.oid, source: 'subspaceTenantId' };

  let canonicalOid =
    parseCanonicalProjectOid(tenant.identifier) ??
    parseCanonicalProjectOid(tenant.resourceTenantIdentifier);
  if (canonicalOid !== null && (await projectExists(canonicalOid))) {
    return { status: 'resolved', value: canonicalOid, source: 'canonicalIdentifier' };
  }

  let legacyInstanceId = parseLegacyTenantInstanceId(tenant.identifier);
  if (legacyInstanceId) {
    let instance = await loadInstance({ id: legacyInstanceId });
    if (instance) {
      return {
        status: 'resolved',
        value: instance.projectOid,
        source: 'legacyInstanceIdentifier'
      };
    }
  }

  let legacyOrganizationId = parseLegacyTenantOrganizationId(tenant.identifier);
  if (legacyOrganizationId) {
    let organization = await metorialDb.organization.findUnique({
      where: { id: legacyOrganizationId },
      select: { oid: true }
    });

    if (organization) {
      let projects = await metorialDb.project.findMany({
        where: { organizationOid: organization.oid, status: 'active' },
        select: { oid: true },
        orderBy: { oid: 'asc' },
        take: 2
      });

      let project = projects[0];
      if (projects.length === 1 && project) {
        return {
          status: 'resolved',
          value: project.oid,
          source: 'legacyOrganizationIdentifier'
        };
      }

      return {
        status: 'unresolved',
        reason: `Organization ${legacyOrganizationId} behind tenant ${tenant.id} has ${projects.length === 0 ? 'no' : 'more than one'} active project`
      };
    }
  }

  let environments = await subspaceDb.environment.findMany({
    where: { tenant: { id: tenant.id } },
    select: {
      id: true,
      identifier: true,
      resourceGroupIdentifier: true,
      instanceOid: true
    }
  });

  let projectOids = new Set<bigint>();
  for (let environment of environments) {
    let resolution = await resolveInstanceForEnvironment(environment);
    if (resolution.status === 'resolved') projectOids.add(resolution.value.projectOid);
  }

  if (projectOids.size === 1) {
    return {
      status: 'resolved',
      value: [...projectOids][0]!,
      source: 'environments'
    };
  }

  return {
    status: 'unresolved',
    reason: `No Metorial project resolves for subspace tenant ${tenant.id} (${tenant.identifier})`
  };
};

export type ProjectScopeDrift = {
  hasDrift: boolean;
  reasons: string[];
  notes: string[];
};

export let getProjectScopeDrift = async (d: {
  projectOid: bigint;
}): Promise<ProjectScopeDrift> => {
  let project = await metorialDb.project.findUnique({
    where: { oid: d.projectOid },
    select: {
      oid: true,
      id: true,
      subspaceTenantId: true,
      internalTenantIdentifier: true,
      instances: {
        select: {
          oid: true,
          id: true,
          subspaceTenantId: true,
          internalTenantIdentifier: true,
          subspaceEnvironmentId: true,
          internalEnvironmentIdentifier: true
        }
      }
    }
  });

  let reasons: string[] = [];
  let notes: string[] = [];
  let result = () => ({ hasDrift: reasons.length > 0, reasons, notes });

  if (!project) return result();

  let tenantIdentifier = `${CANONICAL_TENANT_PREFIX}${project.oid}`;

  if (!project.subspaceTenantId) return result();

  let tenant = await subspaceDb.tenant.findUnique({
    where: { id: project.subspaceTenantId },
    select: { oid: true, identifier: true, retiredAt: true }
  });

  if (!tenant) {
    reasons.push(`Project ${project.id} points at missing tenant ${project.subspaceTenantId}`);
    return result();
  }
  if (tenant.retiredAt) {
    reasons.push(`Project ${project.id} points at retired tenant ${project.subspaceTenantId}`);
    return result();
  }

  if (
    isCanonicalProjectIdentifier(tenant.identifier) &&
    tenant.identifier !== tenantIdentifier
  ) {
    notes.push(
      `Project ${project.id} points at tenant ${tenant.identifier}, which names another project`
    );
    return result();
  }

  if (tenant.identifier !== tenantIdentifier) {
    reasons.push(
      `Project ${project.id} resolves to tenant ${tenant.identifier}, expected ${tenantIdentifier}`
    );
  }
  if (project.internalTenantIdentifier !== tenantIdentifier) {
    reasons.push(
      `Project ${project.id} is labelled ${project.internalTenantIdentifier}, expected ${tenantIdentifier}`
    );
  }

  for (let instance of project.instances) {
    let environmentIdentifier = `${CANONICAL_ENVIRONMENT_PREFIX}${instance.oid}`;

    if (
      instance.internalTenantIdentifier &&
      instance.internalTenantIdentifier !== tenantIdentifier
    ) {
      reasons.push(
        `Instance ${instance.id} is labelled ${instance.internalTenantIdentifier}, expected ${tenantIdentifier}`
      );
    }
    if (instance.subspaceTenantId && instance.subspaceTenantId !== project.subspaceTenantId) {
      reasons.push(`Instance ${instance.id} points at a different tenant than its project`);
    }

    if (!instance.subspaceEnvironmentId) continue;

    let environment = await subspaceDb.environment.findUnique({
      where: { id: instance.subspaceEnvironmentId },
      select: { identifier: true, tenantOid: true }
    });

    if (!environment) {
      reasons.push(
        `Instance ${instance.id} points at missing environment ${instance.subspaceEnvironmentId}`
      );
      continue;
    }

    if (
      isCanonicalEnvironmentIdentifier(environment.identifier) &&
      environment.identifier !== environmentIdentifier
    ) {
      notes.push(
        `Instance ${instance.id} points at environment ${environment.identifier}, which names another instance`
      );
      continue;
    }

    if (environment.identifier !== environmentIdentifier) {
      reasons.push(
        `Instance ${instance.id} resolves to environment ${environment.identifier}, expected ${environmentIdentifier}`
      );
    }
    if (environment.tenantOid !== tenant.oid) {
      reasons.push(`Instance ${instance.id} environment sits under a different tenant`);
    }
    if (instance.internalEnvironmentIdentifier !== environmentIdentifier) {
      reasons.push(
        `Instance ${instance.id} environment is labelled ${instance.internalEnvironmentIdentifier}, expected ${environmentIdentifier}`
      );
    }
  }

  return result();
};
