import { uniqueId } from '@lowerdeck/testing-tools';
import { nebula } from './client';

export let consumerSecrets = {
  worker: 'e2e-worker-registration-secret',
  owner: 'e2e-owner-registration-secret',
  other: 'e2e-other-registration-secret'
};

export let createTenant = (prefix = 'tenant') =>
  nebula.tenant.upsert({ identifier: uniqueId(prefix), name: 'Test Tenant' });

export let registerConsumer = (consumer: keyof typeof consumerSecrets = 'worker') =>
  nebula.consumer.register({
    secret: consumerSecrets[consumer],
    identifier: uniqueId(`${consumer}-instance`).toUpperCase()
  });

export let createSecret = async (input: {
  tenantId: string;
  consumerToken: string;
  secret?: string;
  proof?: Record<string, any>;
  purpose?: string;
}) =>
  nebula.secret.create({
    tenantId: input.tenantId,
    consumerToken: input.consumerToken,
    purpose: input.purpose ?? uniqueId('purpose'),
    secret: input.secret ?? 'high-entropy-secret-value',
    proof: input.proof ?? { binding: 'default' }
  });
