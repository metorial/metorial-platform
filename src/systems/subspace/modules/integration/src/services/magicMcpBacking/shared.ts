import { createLock } from '@lowerdeck/lock';
import {
  type Environment,
  type Solution,
  type Tenant
} from '@metorial-subspace/db';
import { identityActorService } from '@metorial-subspace/module-identity';
import { env } from '../../env';
import { integrationInclude } from '../integration';
import { integrationInstanceProviderInclude } from '../integrationInstance';
import { integrationInstanceGroupInclude } from '../integrationInstanceGroup';

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
  maxSessionDurationInMinutes: number;
};

let magicMcpBackingLock = createLock({
  name: 'sub/int/magicMcpBacking/upsert/lock',
  redisUrl: env.service.REDIS_URL
});

export let withMagicMcpBackingLock = async <T>(keys: string | string[], cb: () => Promise<T>) => {
  let sortedKeys = Array.isArray(keys) ? Array.from(new Set(keys)).sort() : [keys];

  let run = async (idx: number): Promise<T> => {
    let key = sortedKeys[idx];
    if (!key) return await cb();

    return await magicMcpBackingLock.usingLock(key, async () => await run(idx + 1));
  };

  return await run(0);
};

export let magicMcpProviderTemplateBackingInclude = {
  integration: {
    include: integrationInclude
  }
} as const;

export let magicMcpServerBackingInclude = {
  providerTemplateBacking: {
    include: magicMcpProviderTemplateBackingInclude
  },
  integration: {
    include: integrationInclude
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
}) => {
  if (!d.identityActorId) return null;

  let actor = await identityActorService.getIdentityActorById({
    tenant: d.tenant,
    solution: d.solution,
    environment: d.environment,
    identityActorId: d.identityActorId
  });

  return actor.oid;
};
