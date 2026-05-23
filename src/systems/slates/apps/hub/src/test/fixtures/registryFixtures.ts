import { randomBytes } from 'crypto';
import type { PrismaClient, Registry } from '../../../prisma/generated/client';
import { RegistryStatus } from '../../../prisma/generated/client';
import { getId } from '../../id';
import { defineFactory } from '@mtsrc/testing-tools';

export const RegistryFixtures = (db: PrismaClient) => {
  const defaultRegistry = async (
    overrides: Partial<Registry> = {}
  ): Promise<Registry> => {
    const { oid, id } = getId('registry');
    const identifier =
      overrides.identifier ?? `test-registry-${randomBytes(4).toString('hex')}`;

    const factory = defineFactory<Registry>(
      {
        oid,
        id,
        identifier,
        name: overrides.name ?? 'Test Registry',
        url: overrides.url ?? 'http://localhost:52040',
        status: overrides.status ?? RegistryStatus.active,
        isPredefined: overrides.isPredefined ?? false
      } as Registry,
      {
        persist: value => db.registry.create({ data: value })
      }
    );

    return factory.create(overrides);
  };

  const withStatus = async (
    status: RegistryStatus,
    overrides: Partial<Registry> = {}
  ): Promise<Registry> => defaultRegistry({ ...overrides, status });

  const disabled = async (overrides: Partial<Registry> = {}): Promise<Registry> =>
    withStatus(RegistryStatus.disabled, overrides);

  return {
    default: defaultRegistry,
    withStatus,
    disabled
  };
};
