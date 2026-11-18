import { check, describeError, type CheckDefinition } from '@lowerdeck/doctor';
import {
  baselineChecks,
  bunRedis,
  failFromError,
  postgresChecks,
  prismaQuery,
  queueChecks,
  redisChecks
} from '@metorial/doctor';
import type { RedisClient } from 'bun';
import { getKeyProviderAdapter } from './adapters';
import { db } from './db';
import { consumerRegistrationSecrets, defaultProviderType } from './env';

let kmsResolutions: Record<string, { summary: string; steps: string[] }> = {
  'aws.kms': {
    summary: 'The AWS KMS key is not usable by the secret-store role.',
    steps: [
      'Grant kms:GenerateDataKey, kms:Decrypt and kms:DescribeKey on the key.',
      'With IRSA, check the eks.amazonaws.com/role-arn annotation on the secret-store ServiceAccount.',
      'Check that the key is enabled, not pending deletion, and in the configured region.'
    ]
  },
  'gcp.kms': {
    summary: 'The Cloud KMS key is not usable by the secret-store identity.',
    steps: [
      'Grant roles/cloudkms.cryptoKeyEncrypterDecrypter on the key, and check Workload Identity.'
    ]
  },
  'azure.keyvault': {
    summary: 'The Key Vault key is not usable by the secret-store identity.',
    steps: ['Assign Key Vault Crypto User, or an access policy with wrap and unwrap key.']
  },
  local: {
    summary: 'The local key provider cannot use its key.',
    steps: ['Check that every component uses the same installation secret (masterSecret).']
  }
};

type StoredProvider = { type: string; keyInfo: unknown };

let adapterFor = () => {
  let adapter = getKeyProviderAdapter(defaultProviderType);
  if (!adapter) throw new Error(`Unknown key provider type ${defaultProviderType}`);
  return adapter;
};

let fingerprintOf = (provider: StoredProvider) =>
  (provider.keyInfo as { fingerprint?: string } | null)?.fingerprint;

let systemProviders = (): Promise<StoredProvider[]> =>
  db.keyProvider.findMany({
    where: {
      owner: 'system',
      tenantOid: null,
      deletedAt: null,
      systemIdentifier: { startsWith: 'system:global:default' }
    },
    orderBy: { createdAt: 'desc' }
  });

export let secretStoreDoctorChecks = (redis: RedisClient): CheckDefinition[] => [
  ...baselineChecks(),
  ...postgresChecks({
    name: 'nebula',
    query: prismaQuery(db),
    schemaProbe: () => db.tenant.count()
  }),
  ...redisChecks({ client: bunRedis(redis) }),
  ...queueChecks(),

  check({
    id: 'kms.provider.configured',
    title: 'Key provider is configured',
    category: 'security',
    severity: 'critical',
    run: ctx => {
      try {
        adapterFor().getSystemFingerprint();
        return ctx.pass(`The ${defaultProviderType} key provider is configured.`, {
          provider: defaultProviderType
        });
      } catch (error) {
        return ctx.fail({
          message: `The ${defaultProviderType} key provider is not configured: ${(error as Error).message}`,
          resolution: {
            summary: 'Set the providers.kms values for the selected provider.',
            docs: 'datacenter/operations/doctor#kms'
          }
        });
      }
    }
  }),

  check({
    id: 'kms.provider.unchanged',
    title: 'Key provider matches the stored secrets',
    category: 'security',
    severity: 'critical',
    dependsOn: ['kms.provider.configured', 'postgres.nebula.connect'],
    run: async ctx => {
      let adapter = adapterFor();
      let fingerprint = adapter.getSystemFingerprint();
      let providers = await systemProviders();

      if (!providers.length)
        return ctx.pass('No system key provider exists yet; one is created on first use.');

      let matching = providers.find(
        provider =>
          provider.type == defaultProviderType && fingerprintOf(provider) == fingerprint
      );
      if (matching)
        return ctx.pass(
          'The configured key provider is the one the secrets were stored with.'
        );

      return ctx.fail({
        message:
          'The key provider changed since secrets were stored; existing secrets cannot be decrypted.',
        resolution: {
          summary:
            'Restore the previous key provider settings (provider type, key ID and installation secret).',
          steps: [
            'Never change providers.kms or regenerate masterSecret on an existing installation.',
            'If the change is intentional and no secrets need to survive, set allowProviderChange.'
          ],
          docs: 'datacenter/operations/doctor#kms'
        },
        details: {
          configured: defaultProviderType,
          stored: providers.map(provider => provider.type)
        }
      });
    }
  }),

  check({
    id: 'kms.decrypt-existing',
    title: 'Stored data keys can be decrypted',
    category: 'security',
    severity: 'critical',
    dependsOn: ['kms.provider.configured', 'postgres.nebula.connect'],
    minIntervalMs: 5 * 60_000,
    timeoutMs: 10_000,
    run: async ctx => {
      let key = await db.key.findFirst({
        where: { keyProvider: { owner: 'system' } },
        orderBy: { createdAt: 'desc' },
        include: { keyProvider: true, tenant: true }
      });
      if (!key) return ctx.skip('No data key has been stored yet.');

      let adapter = getKeyProviderAdapter(key.keyProvider.type);
      if (!adapter) return ctx.skip(`Unknown key provider type ${key.keyProvider.type}.`);

      try {
        await adapter.decryptDataKey(key.keyProvider, key.encryptedDataKey, key.keyInfo, {
          tenantId: key.tenant.id,
          tenantOid: key.tenant.oid,
          keyProviderId: key.keyProvider.id,
          keyProviderOid: key.keyProvider.oid,
          keyId: key.id
        });

        return ctx.pass('An existing data key was decrypted.');
      } catch (error) {
        return ctx.fail({
          message: `Existing secrets can't be decrypted: ${describeError(error).message}`,
          resolution: {
            summary:
              'The key material changed since the secrets were stored; with the local provider this means a different installation secret.',
            steps: [
              'Restore the previous installation secret (masterSecret) or key provider settings.',
              'Never regenerate the installation secret on an existing installation.'
            ],
            docs: 'datacenter/operations/doctor#kms'
          },
          details: { provider: key.keyProvider.type }
        });
      }
    }
  }),

  check({
    id: 'secret-store.consumers',
    title: 'Secret consumers are registered',
    category: 'configuration',
    severity: 'critical',
    dependsOn: ['postgres.nebula.connect'],
    run: async ctx => {
      if (!consumerRegistrationSecrets.length) {
        return ctx.skip('No consumer registration secrets are configured.');
      }

      let identifiers = consumerRegistrationSecrets.map(item => item.identifier);
      let registered = await db.consumer.findMany({
        where: { identifier: { in: identifiers } },
        select: { identifier: true, status: true }
      });

      let inactive = identifiers.filter(
        (identifier: string) =>
          registered.find(
            (item: { identifier: string; status: string }) => item.identifier == identifier
          )?.status != 'active'
      );
      if (inactive.length) {
        return ctx.fail({
          message: `The consumers ${inactive.join(', ')} are not registered or not active.`,
          resolution: {
            summary:
              'Restart secret-store so it registers its consumers, and check its CONSUMER_REGISTRATION_* secrets.',
            docs: 'datacenter/operations/doctor#kms'
          },
          details: { inactive }
        });
      }

      return ctx.pass(`${identifiers.length} consumers are registered.`, { identifiers });
    }
  }),

  check({
    id: 'kms.system-key.access',
    title: 'System key can encrypt and decrypt',
    category: 'security',
    severity: 'critical',
    dependsOn: ['kms.provider.configured', 'postgres.nebula.connect'],
    minIntervalMs: 5 * 60_000,
    timeoutMs: 10_000,
    run: async ctx => {
      let adapter = adapterFor();
      let fingerprint = adapter.getSystemFingerprint();
      let provider = (await systemProviders()).find(
        candidate =>
          candidate.type == defaultProviderType && fingerprintOf(candidate) == fingerprint
      );
      if (!provider) return ctx.skip('No system key provider exists yet.');

      try {
        let started = performance.now();
        await adapter.verifySystemKeyAccess(provider.keyInfo);
        let latencyMs = Math.round(performance.now() - started);

        if (latencyMs > 1_000) {
          return ctx.warn({
            message: `The key round trip took ${latencyMs}ms.`,
            details: { latencyMs }
          });
        }

        return ctx.pass(`Generated and decrypted a data key in ${latencyMs}ms.`, {
          latencyMs
        });
      } catch (error) {
        let outcome = failFromError(ctx, 'dependency', error, {
          provider: defaultProviderType
        });
        return {
          ...outcome,
          resolution: {
            ...kmsResolutions[defaultProviderType]!,
            docs: 'datacenter/operations/doctor#kms'
          }
        };
      }
    }
  })
];
