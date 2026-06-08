import { createLock } from '@lowerdeck/lock';
import { type Environment, type Solution, type Tenant } from '@metorial-subspace/db';
import { identityActorService, identityService } from '@metorial-subspace/module-identity';
import { env } from '../../env';
import { integrationProviderVersionInclude } from '../../lib/integrationIncludes';
import { integrationInstanceProviderInclude } from '../integrationInstance';
import { integrationInstanceGroupInclude } from '../integrationInstanceGroup';
import { integrationVersionInclude } from '../integrationVersion';

export type BackingProviderInput = {
  providerDeploymentId: string;
  providerConfigId?: string | null;
  providerAuthConfigId?: string | null;
  toolFilters?: PrismaJson.ToolFilter | null;
};

export type MagicMcpBackingInputBase = {
  id: string;
  name?: string | null;
  description?: string | null;
  metadata?: Record<string, any> | null;
  privateMetadata?: Record<string, any> | null;
  identityActorId?: string | null;
  identityId?: string | null;
  maxSessionDurationInMinutes: number;
};

export type MagicMcpOwnerType = 'provider_template' | 'integration' | 'server_owned';

let magicMcpBackingLock = createLock({
  name: 'sub/int/magicMcpBacking/upsert/lock',
  redisUrl: env.service.REDIS_URL
});

export let withMagicMcpBackingLock = async <T>(
  keys: string | string[],
  cb: () => Promise<T>
) => {
  let sortedKeys = Array.isArray(keys) ? Array.from(new Set(keys)).sort() : [keys];

  let run = async (idx: number): Promise<T> => {
    let key = sortedKeys[idx];
    if (!key) return await cb();

    return await magicMcpBackingLock.usingLock(key, async () => await run(idx + 1));
  };

  return await run(0);
};

let magicMcpBackingIntegrationInclude = {
  currentVersion: {
    include: integrationVersionInclude
  },
  providers: {
    where: { status: 'active' as const },
    include: {
      provider: true,
      currentVersion: {
        include: integrationProviderVersionInclude
      }
    }
  },
  providerTemplateBacking: true,
  magicMcpServerBacking: true
} as const;

export let magicMcpProviderTemplateBackingInclude = {
  integration: {
    include: magicMcpBackingIntegrationInclude
  }
} as const;

export let magicMcpServerBackingInclude = {
  providerTemplateBacking: {
    include: magicMcpProviderTemplateBackingInclude
  },
  ownerIntegration: {
    include: magicMcpBackingIntegrationInclude
  },
  integration: {
    include: magicMcpBackingIntegrationInclude
  },
  integrationInstance: {
    include: {
      integration: true,
      identityActor: true,
      identity: true,
      integrationInstanceProviders: {
        where: { status: 'active' as const, isParentDeleted: false },
        include: integrationInstanceProviderInclude
      }
    }
  },
  sessionTemplate: true,
  ephemeralManagedSession: true,
  actor: true
} as const;

export let getMagicMcpOwnerType = (d: {
  ownerType: MagicMcpOwnerType;
  providerTemplateBackingOid?: bigint | null;
  ownerIntegrationOid?: bigint | null;
}) => {
  if (d.ownerType === 'provider_template' || d.providerTemplateBackingOid) {
    return 'provider_template' as const;
  }
  if (d.ownerType === 'integration' || d.ownerIntegrationOid) {
    return 'integration' as const;
  }

  return 'server_owned' as const;
};

export let getMagicMcpOwnerIntegration = <
  T extends {
    ownerType: MagicMcpOwnerType;
    providerTemplateBacking: { integration: any } | null;
    ownerIntegration: any | null;
    integration: any | null;
  }
>(
  backing: T
) => {
  let ownerType = getMagicMcpOwnerType(backing);
  if (ownerType === 'provider_template') {
    return backing.providerTemplateBacking?.integration ?? null;
  }
  if (ownerType === 'integration') {
    return backing.ownerIntegration ?? null;
  }

  return backing.integration ?? null;
};

export let magicMcpEndpointBackingInclude = {
  integrationGroup: {
    include: integrationInstanceGroupInclude
  },
  sessionTemplate: true,
  ephemeralManagedSession: true,
  actor: true,
  servers: {
    include: {
      magicMcpServerBacking: {
        include: magicMcpServerBackingInclude
      }
    }
  }
} as const;

export let resolveActorOid = async (d: {
  tenant: Tenant;
  solution: Solution;
  environment: Environment;
  identityActorId?: string | null;
  identityId?: string | null;
}) => {
  if (!d.identityActorId && d.identityId) {
    let identity = await identityService.getIdentityById({
      tenant: d.tenant,
      solution: d.solution,
      environment: d.environment,
      identityId: d.identityId
    });

    return identity?.actorOid ?? null;
  }

  if (!d.identityActorId) return null;

  let actor = await identityActorService.getIdentityActorById({
    tenant: d.tenant,
    solution: d.solution,
    environment: d.environment,
    identityActorId: d.identityActorId
  });

  return actor.oid;
};
