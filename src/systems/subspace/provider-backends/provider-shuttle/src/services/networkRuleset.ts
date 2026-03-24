import type { PaginatorInput } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Tenant } from '@metorial-subspace/db';
import { getTenantForShuttle, shuttle, type NetworkingRuleset } from '../client';

class networkingRulesetServiceImpl {
  async getNetworkingRulesetById(d: { networkingRulesetId: string; tenant: Tenant }) {
    let tenant = await getTenantForShuttle(d.tenant);
    return shuttle.networkingRuleset.get({
      tenantId: tenant.id,
      networkingRulesetId: d.networkingRulesetId
    });
  }

  async listNetworkingRulesets(d: { tenant: Tenant } & PaginatorInput) {
    let tenant = await getTenantForShuttle(d.tenant);
    return shuttle.networkingRuleset.list({
      ...(d as any),
      tenant: undefined,
      tenantId: tenant.id
    });
  }

  async createNetworkingRulesetById(d: {
    tenant: Tenant;
    input: {
      name: string;
      description?: string;
      isDefault?: boolean;
      defaultAction: 'accept' | 'deny';
      rules: {
        action: 'accept' | 'deny';
        protocol?: 'tcp' | 'udp' | 'icmp';
        destination?: string;
        port?: number;
        portRange: {
          start: number;
          end: number;
        };
      }[];
    };
  }) {
    let tenant = await getTenantForShuttle(d.tenant);
    return shuttle.networkingRuleset.create({
      tenantId: tenant.id,
      ...d.input
    });
  }

  async updateNetworkingRuleset(d: {
    networkingRuleset: NetworkingRuleset;
    tenant: Tenant;

    input: {
      name?: string;
      description?: string;
      defaultAction?: 'accept' | 'deny';
      rules?: {
        action: 'accept' | 'deny';
        protocol?: 'tcp' | 'udp' | 'icmp';
        destination?: string;
        port?: number;
        portRange: {
          start: number;
          end: number;
        };
      }[];
    };
  }) {
    let tenant = await getTenantForShuttle(d.tenant);
    return shuttle.networkingRuleset.update({
      ...d.input,
      tenantId: tenant.id,
      networkingRulesetId: d.networkingRuleset.id,
      defaultAction: d.input.defaultAction ?? d.networkingRuleset.defaultAction,
      rules: d.input.rules ?? d.networkingRuleset.rules
    });
  }
}

export let networkingRulesetService = Service.create(
  'networkingRuleset',
  () => new networkingRulesetServiceImpl()
).build();
