import { createLocallyCachedFunction } from '@mtsrc/cache';
import { badRequestError, goneError, notFoundError, ServiceError } from '@mtsrc/error';
import { Paginator } from '@mtsrc/pagination';
import { Service } from '@mtsrc/service';
import { isValidCIDR } from 'ipaddr.js';
import type {
  NetworkingRuleset,
  ServerConnection,
  Tenant
} from '../../prisma/generated/client';
import { db } from '../db';
import { getId } from '../id';

let include = {
  tenant: true
};

let globalRules = createLocallyCachedFunction({
  getHash: (v: void) => 'global_networking_rulesets',
  ttlSeconds: 60 * 5,
  provider: () =>
    db.globalNetworkingRuleset.findMany({
      where: { status: 'active' }
    })
});

export interface NetworkingRulesetInput {
  defaultAction: 'accept' | 'deny';
  rules: {
    action: 'accept' | 'deny';
    protocol?: 'tcp' | 'udp' | 'icmp';
    destination?: string;
    port?: number;
    portRange?: { start: number; end: number };
  }[];
}

class networkingRulesetServiceImpl {
  async createNetworkingRuleset(d: {
    tenant: Tenant;
    input: NetworkingRulesetInput & {
      name: string;
      description?: string;
      isDefault?: boolean;
    };
  }) {
    let rules = this.normalizeNetworkingRuleset(d);

    return await db.networkingRuleset.create({
      data: {
        ...getId('networkingRuleset'),
        tenantOid: d.tenant.oid,
        status: 'active',
        name: d.input.name,
        description: d.input.description || undefined,
        isDefault: !!d.input.isDefault,
        rules
      },
      include
    });
  }

  async getNetworkingRulesetById(d: { tenant: Tenant; networkingRulesetId: string }) {
    let networkingRuleset = await db.networkingRuleset.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        id: d.networkingRulesetId
      },
      include
    });
    if (!networkingRuleset) throw new ServiceError(notFoundError('networking_ruleset'));
    return networkingRuleset;
  }

  async updateNetworkingRuleset(d: {
    input: Partial<NetworkingRulesetInput> & {
      name?: string;
      description?: string;
    };
    networkingRuleset: NetworkingRuleset;
  }) {
    if (d.networkingRuleset.status !== 'active') {
      throw new ServiceError(
        goneError({
          message: 'Cannot update a networking ruleset that is not active'
        })
      );
    }

    let rules = this.normalizeNetworkingRuleset({
      input: {
        defaultAction: d.input.defaultAction ?? d.networkingRuleset.rules.defaultAction,
        rules: d.input.rules ?? d.networkingRuleset.rules.rules
      }
    });

    return await db.networkingRuleset.update({
      where: {
        oid: d.networkingRuleset.oid
      },
      data: {
        rules,
        name: d.input.name,
        description: d.input.description
      },
      include
    });
  }

  async deleteNetworkingRuleset(d: { networkingRuleset: NetworkingRuleset }) {
    if (d.networkingRuleset.status !== 'active') {
      throw new ServiceError(
        goneError({
          message: 'Cannot delete a networking ruleset that is not active'
        })
      );
    }

    return await db.networkingRuleset.update({
      where: {
        oid: d.networkingRuleset.oid
      },
      data: {
        status: 'inactive'
      },
      include
    });
  }

  async listNetworkingRulesets(d: { tenant: Tenant; isDefault?: boolean; ids?: string[] }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.networkingRuleset.findMany({
            ...opts,
            where: { tenantOid: d.tenant.oid, status: 'active' },
            include
          })
      )
    );
  }

  async getRulesetForConnection(d: { connection: ServerConnection }) {
    let assignedAndDefaultRulesets = await db.networkingRuleset.findMany({
      where: {
        OR: [
          {
            connections: { some: { serverConnectionOid: d.connection.oid } },
            tenantOid: d.connection.tenantOid,
            status: 'active'
          },
          {
            tenantOid: d.connection.tenantOid,
            isDefault: true,
            status: 'active'
          }
        ]
      },
      include
    });
    let global = await globalRules();

    let allRulesets = [
      ...assignedAndDefaultRulesets.map(r => r.rules),
      ...global.map(r => r.rules)
    ];

    let defaultAction: 'accept' | 'deny' = 'accept';
    for (let ruleset of allRulesets) {
      if (ruleset.defaultAction === 'deny') defaultAction = 'deny';
    }

    let rules = allRulesets.flatMap(r => r.rules);

    return {
      defaultAction,
      rules
    };
  }

  async getManyNetworkingRulesetsByIds(d: { tenant: Tenant; ids: string[] }) {
    let networkingRulesets = await db.networkingRuleset.findMany({
      where: {
        tenantOid: d.tenant.oid,
        id: { in: d.ids },
        status: 'active'
      },
      include
    });

    let uniqueIds = new Set(d.ids);
    if (networkingRulesets.length !== uniqueIds.size) {
      throw new ServiceError(
        badRequestError({
          message: 'One or more networking ruleset IDs are invalid'
        })
      );
    }

    return networkingRulesets;
  }

  private normalizeNetworkingRuleset(d: {
    input: {
      defaultAction: 'accept' | 'deny';
      rules: {
        action: 'accept' | 'deny';
        protocol?: 'tcp' | 'udp' | 'icmp';
        destination?: string;
        port?: number;
        portRange?: { start: number; end: number };
      }[];
    };
  }) {
    for (let rule of d.input.rules) {
      if (!rule.destination && !rule.port && !rule.protocol) {
        throw new ServiceError(
          notFoundError(
            'At least one of destination, port, or protocol must be specified in a networking rule'
          )
        );
      }

      if (rule.destination && !isValidCIDR(rule.destination)) {
        throw new ServiceError(
          notFoundError(`Invalid CIDR notation for destination: ${rule.destination}`)
        );
      }

      if (rule.portRange) {
        if (rule.port !== undefined) {
          throw new ServiceError(
            notFoundError('Cannot specify both port and portRange in the same networking rule')
          );
        }

        if (
          rule.portRange.start < 1 ||
          rule.portRange.start > 65535 ||
          rule.portRange.end < 1 ||
          rule.portRange.end > 65535
        ) {
          throw new ServiceError(
            notFoundError(`Invalid port range: ${rule.portRange.start}-${rule.portRange.end}`)
          );
        }

        if (rule.portRange.start > rule.portRange.end) {
          throw new ServiceError(
            notFoundError(
              `Invalid port range: from (${rule.portRange.start}) cannot be greater than to (${rule.portRange.end})`
            )
          );
        }
      }

      if (rule.port !== undefined) {
        if (rule.port < 1 || rule.port > 65535) {
          throw new ServiceError(notFoundError(`Invalid port: ${rule.port}`));
        }
      }
    }

    return {
      v: 1,
      defaultAction: d.input.defaultAction,
      rules: d.input.rules.map(r => ({
        action: r.action,
        protocol: r.protocol || undefined,
        destination: r.destination || undefined,
        portRange: r.portRange
          ? { start: r.portRange.start, end: r.portRange.end }
          : { start: r.port!, end: r.port! }
      }))
    } satisfies PrismaJson.NetworkingRulesetList;
  }
}

export let networkingRulesetService = Service.create(
  'networkingRulesetService',
  () => new networkingRulesetServiceImpl()
).build();
