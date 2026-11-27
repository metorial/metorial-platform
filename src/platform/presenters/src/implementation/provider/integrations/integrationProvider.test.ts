import type { ValidationTypeValue } from '@lowerdeck/validation';
import type { GetTypeOfPresentable, PresenterContext } from '@metorial/presenter';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/db', () => ({}));
vi.mock('@metorial-subspace/db', () => ({
  ProviderAuthMethodType: {
    oauth: 'oauth',
    token: 'token',
    service_account: 'service_account',
    custom: 'custom'
  }
}));
vi.mock('@metorial-subspace/provider-utils', () => ({}));
vi.mock('@metorial-subspace/connection-utils', () => ({}));

import type { integrationProviderType, magicMcpServerProviderType } from '../../../types';
import { effectiveProviderAuthMethodSchema } from '../auth';
import { v1MagicMcpServerProviderPresenter } from '../magicMcp/magicMcpServerProvider';
import {
  dashboardIntegrationProviderPresenter,
  dashboardIntegrationProviderSnapshot
} from './integrationProvider';

type DeepPartial<T> = T extends Date | bigint
  ? T
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

type RawIntegrationProvider = GetTypeOfPresentable<
  typeof integrationProviderType
>['integrationProvider'];
type RawIntegrationProviderVersion = NonNullable<RawIntegrationProvider['currentVersion']>;
type RawAuthMethod = NonNullable<RawIntegrationProviderVersion['authMethod']>;
type RawDeployment = RawIntegrationProviderVersion['deployment'];
type AuthMethodValue = RawAuthMethod['value'];
type MagicMcpServerProviderInput = GetTypeOfPresentable<typeof magicMcpServerProviderType>;

type EffectiveAuthMethod = ValidationTypeValue<typeof effectiveProviderAuthMethodSchema>;
type IsExactly<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type HasIndexSignature<T> = string extends keyof T ? true : false;

let effectiveSchemaKeepsFieldTypes: [
  HasIndexSignature<EffectiveAuthMethod>,
  IsExactly<EffectiveAuthMethod['type'], 'oauth' | 'token' | 'custom'>,
  IsExactly<EffectiveAuthMethod['description'], string | null>,
  IsExactly<EffectiveAuthMethod['capabilities'], Record<string, any>>
] = [false, true, true, true];

let fixture = <T>(partial: DeepPartial<T>) => partial as T;

let context: PresenterContext = {
  apiVersion: 'mt_2025_01_01_dashboard',
  accessType: 'organization_management'
};

let timestamp = new Date('2026-01-01T00:00:00Z');
let pinnedGlobalOid = BigInt(1);

let pinnedCapabilities = { pinnedOnly: true };
let currentCapabilities = { adminSetup: { enabled: true } };
let lockedCapabilities = { lockedOnly: true };
let latestCapabilities = { latestOnly: true };

let provider = {
  id: 'pro_1',
  name: 'GitHub',
  description: null,
  slug: 'github',
  createdAt: timestamp,
  updatedAt: timestamp
};

let authMethodValue = (capabilities: AuthMethodValue['capabilities']): AuthMethodValue => ({
  specId: 'oauth',
  callableId: 'oauth',
  type: 'oauth',
  key: 'oauth',
  name: 'OAuth',
  inputJsonSchema: { type: 'object', properties: { pinned: { type: 'string' } } },
  capabilities,
  scopes: [{ id: 'repo', title: 'Repositories' }],
  metadata: {}
});

type SpecificationAuthMethodInput = {
  globalOid: bigint;
  capabilities: AuthMethodValue['capabilities'];
  key?: string;
  type?: RawAuthMethod['type'];
  isDefault?: boolean;
};

let specificationAuthMethod = (d: SpecificationAuthMethodInput) => {
  let key = d.key ?? 'oauth';

  return {
    id: `pam_${d.globalOid}_${key}`,
    globalOid: d.globalOid,
    specId: `spec_${key}`,
    specUniqueIdentifier: `unique_${key}`,
    key,
    callableId: `callable_${key}`,
    type: d.type ?? 'oauth',
    isDefault: d.isDefault ?? false,
    createdAt: timestamp,
    value: authMethodValue(d.capabilities)
  };
};

let specificationVersion = (authMethods: SpecificationAuthMethodInput[] | null) => ({
  specification: authMethods && {
    providerAuthMethods: authMethods.map(specificationAuthMethod)
  }
});

let createAuthMethod = () =>
  fixture<RawAuthMethod>({
    id: 'pam_pinned',
    specId: 'oauth',
    specUniqueIdentifier: 'oauth',
    callableId: 'oauth',
    key: 'oauth',
    type: 'oauth',
    isDefault: true,
    name: 'OAuth',
    description: null,
    globalOid: pinnedGlobalOid,
    value: authMethodValue(pinnedCapabilities),
    specification: { id: 'psp_old' },
    createdAt: timestamp,
    updatedAt: timestamp
  });

let createDeployment = (d: {
  current?: SpecificationAuthMethodInput[] | null;
  locked?: SpecificationAuthMethodInput[] | null;
  hasEnvironments?: boolean;
  hasCurrentVersion?: boolean;
}) =>
  fixture<RawDeployment>({
    id: 'pde_1',
    isDefault: true,
    name: 'Default',
    description: null,
    metadata: null,
    currentVersion:
      d.locked === undefined
        ? { lockedVersionOid: null, lockedVersion: null }
        : { lockedVersionOid: BigInt(20), lockedVersion: specificationVersion(d.locked) },
    provider: {
      defaultVariantOid: BigInt(10),
      hasEnvironments: d.hasEnvironments ?? false,
      defaultVariant: {
        currentVersion:
          d.hasCurrentVersion === false ? null : specificationVersion(d.current ?? null)
      }
    },
    createdAt: timestamp,
    updatedAt: timestamp
  });

let createVersion = (d: { authMethod?: RawAuthMethod; deployment: RawDeployment }) =>
  fixture<RawIntegrationProviderVersion>({
    id: 'inpv_1',
    index: 1,
    status: 'active',
    deployment: d.deployment,
    authMethod: d.authMethod ?? createAuthMethod(),
    authCredentials: null,
    config: null,
    createdAt: timestamp
  });

let createIntegrationProvider = (version: RawIntegrationProviderVersion) =>
  fixture<RawIntegrationProvider>({
    id: 'inp_1',
    status: 'active',
    name: 'GitHub',
    description: null,
    metadata: null,
    integration: { id: 'int_1' },
    provider,
    areCallbacksEnabled: false,
    callbacks: [],
    currentVersion: version,
    createdAt: timestamp,
    updatedAt: timestamp,
    archivedAt: null
  });

let presentAuthMethods = async (deployment: RawDeployment) => {
  let version = createVersion({ deployment });
  let integrationProvider = createIntegrationProvider(version);

  let presented = await dashboardIntegrationProviderPresenter
    .present({ integrationProvider }, context)
    .run();
  let snapshot = await dashboardIntegrationProviderSnapshot(
    integrationProvider,
    version,
    context
  );

  return [presented.auth_method!, snapshot.auth_method!];
};

let expectCapabilities = async (deployment: RawDeployment, capabilities: unknown) => {
  for (let authMethod of await presentAuthMethods(deployment)) {
    expect(authMethod.capabilities).toEqual(capabilities);
    expectPinnedFields(authMethod);
  }
};

let expectPinnedFields = (authMethod: any) => {
  expect(authMethod.id).toBe('pam_pinned');
  expect(authMethod.key).toBe('oauth');
  expect(authMethod.provider_specification_id).toBe('psp_old');
  expect(authMethod.input_schema).toEqual({
    type: 'json_schema',
    schema: { type: 'object', properties: { pinned: { type: 'string' } } }
  });
  expect(authMethod.scopes).toEqual([
    expect.objectContaining({ scope: 'repo', name: 'Repositories' })
  ]);
};

describe('integration provider auth method capabilities', () => {
  it('re-describes capabilities on a plain object schema with typed fields', () => {
    expect(effectiveSchemaKeepsFieldTypes).toEqual([false, true, true, true]);
    expect(effectiveProviderAuthMethodSchema.type).toBe('object');
    expect(effectiveProviderAuthMethodSchema.properties?.capabilities?.description).toMatch(
      /provider version the deployment currently uses/
    );
  });

  it("presents the provider's current version capabilities while keeping the pinned fields", async () => {
    await expectCapabilities(
      createDeployment({
        current: [{ globalOid: pinnedGlobalOid, capabilities: currentCapabilities }]
      }),
      currentCapabilities
    );
  });

  it("follows a rollback of the provider's current version instead of the latest instance", async () => {
    let deployment = createDeployment({
      current: [{ globalOid: pinnedGlobalOid, capabilities: currentCapabilities }]
    });
    let version = createVersion({
      deployment,
      authMethod: {
        ...createAuthMethod(),
        global: { currentInstance: { value: authMethodValue(latestCapabilities) } }
      } as RawAuthMethod
    });
    let integrationProvider = createIntegrationProvider(version);

    let presented = await dashboardIntegrationProviderPresenter
      .present({ integrationProvider }, context)
      .run();

    expect(presented.auth_method!.capabilities).toEqual(currentCapabilities);
  });

  it('matches an auth method with a new global identity by key before its type', async () => {
    await expectCapabilities(
      createDeployment({
        current: [
          {
            globalOid: BigInt(3),
            key: 'oauth_v2',
            isDefault: true,
            capabilities: latestCapabilities
          },
          { globalOid: BigInt(2), key: 'oauth', capabilities: currentCapabilities }
        ]
      }),
      currentCapabilities
    );
  });

  it('falls back to an auth method of the same type when nothing else matches', async () => {
    await expectCapabilities(
      createDeployment({
        current: [
          { globalOid: BigInt(2), key: 'token', type: 'token', capabilities: {} },
          { globalOid: BigInt(3), key: 'oauth_v2', capabilities: currentCapabilities }
        ]
      }),
      currentCapabilities
    );
  });

  it('does not resurrect pinned capabilities the current version no longer declares', async () => {
    await expectCapabilities(
      createDeployment({
        current: [{ globalOid: pinnedGlobalOid, capabilities: undefined as never }]
      }),
      undefined
    );
  });

  it('presents the locked version capabilities for a locked deployment', async () => {
    await expectCapabilities(
      createDeployment({
        current: [{ globalOid: pinnedGlobalOid, capabilities: currentCapabilities }],
        locked: [
          { globalOid: BigInt(2), key: 'oauth_v2', capabilities: currentCapabilities },
          { globalOid: pinnedGlobalOid, capabilities: lockedCapabilities }
        ]
      }),
      lockedCapabilities
    );
  });

  it.each([
    ['the locked version has no specification', createDeployment({ locked: null })],
    ['the current version has no specification', createDeployment({ current: null })],
    [
      'the provider resolves versions per environment',
      createDeployment({
        current: [{ globalOid: pinnedGlobalOid, capabilities: currentCapabilities }],
        hasEnvironments: true
      })
    ]
  ])('falls back to the pinned capabilities when %s', async (_, deployment) => {
    await expectCapabilities(deployment, pinnedCapabilities);
  });

  it.each([
    [
      'the resolved version has no matching auth method',
      createDeployment({
        current: [{ globalOid: BigInt(2), key: 'token', type: 'token', capabilities: {} }]
      })
    ],
    ['the provider has no current version', createDeployment({ hasCurrentVersion: false })]
  ])('presents no capabilities when %s', async (_, deployment) => {
    await expectCapabilities(deployment, {});
  });
});

describe('magic MCP server provider auth method capabilities', () => {
  let presentMagicMcpServerProvider = async (d: {
    integrationVersion: RawIntegrationProviderVersion;
    instanceIntegrationVersion?: RawIntegrationProviderVersion;
  }) =>
    await v1MagicMcpServerProviderPresenter
      .present(
        fixture<MagicMcpServerProviderInput>({
          magicMcpServer: { id: 'mms_1' },
          magicMcpServerProvider: {
            id: 'mmsp_1',
            status: 'active',
            magicMcpServerBacking: { ownerType: 'server_owned' },
            integrationProvider: {
              id: 'inp_1',
              name: 'GitHub',
              description: null,
              metadata: null,
              provider,
              currentVersion: d.integrationVersion
            },
            integrationInstanceProvider: d.instanceIntegrationVersion
              ? {
                  name: 'GitHub',
                  description: null,
                  metadata: null,
                  currentVersion: {
                    toolFilter: null,
                    isOverrideToolFilter: false,
                    config: null,
                    authConfig: null,
                    integrationProviderVersion: d.instanceIntegrationVersion
                  }
                }
              : null,
            createdAt: timestamp,
            updatedAt: timestamp,
            archivedAt: null
          }
        }),
        context
      )
      .run();

  it('presents the effective capabilities of the integration provider version', async () => {
    let presented = await presentMagicMcpServerProvider({
      integrationVersion: createVersion({
        deployment: createDeployment({
          current: [{ globalOid: pinnedGlobalOid, capabilities: currentCapabilities }]
        })
      })
    });

    expect(presented.auth_method?.capabilities).toEqual(currentCapabilities);
    expectPinnedFields(presented.auth_method);
  });

  it('resolves capabilities against the instance provider version when present', async () => {
    let presented = await presentMagicMcpServerProvider({
      integrationVersion: createVersion({
        deployment: createDeployment({
          current: [{ globalOid: pinnedGlobalOid, capabilities: currentCapabilities }]
        })
      }),
      instanceIntegrationVersion: createVersion({
        deployment: createDeployment({
          current: [{ globalOid: pinnedGlobalOid, capabilities: currentCapabilities }],
          locked: [{ globalOid: pinnedGlobalOid, capabilities: lockedCapabilities }]
        })
      })
    });

    expect(presented.auth_method?.capabilities).toEqual(lockedCapabilities);
    expectPinnedFields(presented.auth_method);
  });
});
