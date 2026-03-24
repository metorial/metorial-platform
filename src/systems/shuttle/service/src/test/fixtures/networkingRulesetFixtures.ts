import type {
  PrismaClient,
  NetworkingRuleset,
  Tenant
} from '../../../prisma/generated/client';
import { NetworkingRuleStatus } from '../../../prisma/generated/client';
import { getId } from '../../id';
import { defineFactory } from '@lowerdeck/testing-tools';
import { TenantFixtures } from './tenantFixtures';

export const NetworkingRulesetFixtures = (db: PrismaClient) => {
  const defaultRuleset = async (data: {
    tenantOid: bigint;
    overrides?: Partial<NetworkingRuleset>;
  }): Promise<NetworkingRuleset> => {
    const { oid, id } = getId('networkingRuleset');

    const factory = defineFactory<NetworkingRuleset>(
      {
        oid,
        id,
        isDefault: false,
        name: data.overrides?.name ?? 'Default Ruleset',
        description: data.overrides?.description ?? null,
        status: data.overrides?.status ?? NetworkingRuleStatus.active,
        rules: data.overrides?.rules ?? {
          defaultAction: 'accept',
          rules: []
        },
        tenantOid: data.tenantOid,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data.overrides
      } as NetworkingRuleset,
      {
        persist: value => db.networkingRuleset.create({ data: value })
      }
    );

    return factory.create(data.overrides ?? {});
  };

  const withTenant = async (data?: {
    tenantOverrides?: Partial<Tenant>;
    rulesetOverrides?: Partial<NetworkingRuleset>;
  }): Promise<NetworkingRuleset & { tenant: Tenant }> => {
    const tenantFixtures = TenantFixtures(db);
    const tenant = await tenantFixtures.default(data?.tenantOverrides);

    const ruleset = await defaultRuleset({
      tenantOid: tenant.oid,
      overrides: data?.rulesetOverrides
    });

    return db.networkingRuleset.findUniqueOrThrow({
      where: { id: ruleset.id },
      include: { tenant: true }
    }) as Promise<NetworkingRuleset & { tenant: Tenant }>;
  };

  return {
    default: defaultRuleset,
    withTenant
  };
};
