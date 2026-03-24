import { badRequestError, ServiceError } from '@lowerdeck/error';
import { db } from '@metorial-subspace/db';
import {
  IProviderCapabilities,
  type ProviderSpecificationBehaviorParam,
  type ProviderSpecificationBehaviorRes,
  type ProviderSpecificationGetForPairParam,
  type ProviderSpecificationGetForProviderParam,
  type ProviderSpecificationGetRes
} from '@metorial-subspace/provider-utils';
import { slates } from '../client';

export class ProviderCapabilities extends IProviderCapabilities {
  override async getSpecificationBehavior(
    data: ProviderSpecificationBehaviorParam
  ): Promise<ProviderSpecificationBehaviorRes> {
    return {
      supportsVersionSpecification: true,
      supportsDeploymentSpecification: true
    };
  }

  override async shouldDiscoverSpecificationForProviderPair(
    data: ProviderSpecificationGetForPairParam
  ): Promise<{ shouldDiscover: boolean }> {
    return { shouldDiscover: false };
  }

  override async getSpecificationForProviderPair(
    data: ProviderSpecificationGetForPairParam
  ): Promise<ProviderSpecificationGetRes> {
    return this.getSpecificationForProviderVersion({
      tenant: data.tenant,
      provider: data.provider,
      providerVariant: data.providerVariant,
      providerVersion: data.providerVersion
    });
  }

  override async getSpecificationForProviderVersion(
    data: ProviderSpecificationGetForProviderParam
  ): Promise<ProviderSpecificationGetRes> {
    if (!data.providerVersion.slateVersionOid) {
      throw new Error('Provider version does not have a slate associated with it');
    }

    let slateVersion = await db.slateVersion.findUniqueOrThrow({
      where: { oid: data.providerVersion.slateVersionOid },
      include: { slate: true }
    });

    let slateVersionRecord = await slates.slateVersion.get({
      slateId: slateVersion.slate.id,
      slateVersionId: slateVersion.id
    });

    if (!slateVersionRecord.specification?.specificationId) {
      throw new ServiceError(
        badRequestError({
          message: 'Slate version does not have a specification associated with it'
        })
      );
    }

    let specRecord = await slates.slateSpecification.get({
      slateSpecificationId: slateVersionRecord.specification?.specificationId
    });

    return {
      status: 'success',
      type: 'full',
      features: {
        supportsAuthMethod: specRecord.authMethods.length > 0,
        configContainsAuth: false
      },
      specification: {
        specId: specRecord.id,
        specUniqueIdentifier: specRecord.identifier,
        key: specRecord.key,
        name: specRecord.name,
        description: specRecord.providerInfo.description,
        metadata: specRecord.providerInfo.metadata ?? {},
        configJsonSchema: specRecord.configSchema,
        configVisibility: 'plain',
        triggers: specRecord.triggers
          .map(t => {
            let invocation = t.invocation;
            if (!invocation) return null;

            return {
              specId: t.id,
              specUniqueIdentifier: t.identifier,
              callableId: t.key,
              key: t.key,
              name: t.name,
              description: t.description,
              inputJsonSchema: t.inputSchema,
              outputJsonSchema: t.outputSchema,
              invocation:
                invocation.type === 'polling'
                  ? {
                      type: 'polling' as const,
                      intervalSeconds: invocation.intervalSeconds
                    }
                  : {
                      type: 'webhook' as const,
                      autoRegistration: invocation.autoRegistration,
                      autoUnregistration: invocation.autoUnregistration
                    },
              capabilities: t.capabilities ?? {},
              metadata: t.metadata ?? {}
            };
          })
          .filter((t): t is NonNullable<typeof t> => t !== null),
        mcp: null
      },
      triggers: specRecord.triggers
        .map(t => {
          let invocation = t.invocation;
          if (!invocation) return null;

          return {
            specId: t.id,
            specUniqueIdentifier: t.identifier,
            callableId: t.key,
            key: t.key,
            name: t.name,
            description: t.description,
            inputJsonSchema: t.inputSchema,
            outputJsonSchema: t.outputSchema,
            capabilities: t.capabilities ?? {},
            metadata: t.metadata ?? {},
            invocation:
              invocation.type === 'polling'
                ? {
                    type: 'polling' as const,
                    intervalSeconds: invocation.intervalSeconds
                  }
                : {
                    type: 'webhook' as const,
                    autoRegistration: invocation.autoRegistration,
                    autoUnregistration: invocation.autoUnregistration
                  }
          };
        })
        .filter((t): t is NonNullable<typeof t> => t !== null),
      authMethods: specRecord.authMethods.map(am => ({
        specId: am.id,
        specUniqueIdentifier: am.identifier,
        callableId: am.key,
        key: am.key,
        name: am.name,
        inputJsonSchema: am.inputSchema,
        outputJsonSchema: am.outputSchema,
        scopes: am.scopes,
        type: am.type,
        capabilities: {},
        metadata: {}
      })),
      tools: specRecord.tools.map(t => ({
        specId: t.id,
        specUniqueIdentifier: t.identifier,
        callableId: t.key,
        key: t.key,
        name: t.name,
        description: t.description,
        inputJsonSchema: t.inputSchema,
        outputJsonSchema: t.outputSchema,
        constraints: t.constraints ?? [],
        instructions: t.instructions ?? [],
        capabilities: {},
        mcpToolType: {
          type: 'tool.callable'
        },
        tags: t.tags,
        metadata: {}
      }))
    };
  }
}
