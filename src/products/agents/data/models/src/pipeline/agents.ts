import { agentSeeds, type AgentSeed } from '../registry/agents';
import type { Agent, Vendor } from '../types';
import type { OrganizationIndex } from './organizations';

let vendorRoleOrder = { default: 0, subscription: 1, supported: 2 };

export let normalizeAgentKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/^other:/, '')
    .replace(/[\s_.]+/g, '-');

export let buildAgents = (opts: {
  orgs: OrganizationIndex;
  vendors: Map<string, Vendor>;
  seeds?: AgentSeed[];
}) => {
  let issues: string[] = [];
  let agents: Agent[] = [];

  for (let seed of opts.seeds ?? agentSeeds) {
    if (!opts.orgs.organizations.has(seed.makerId)) {
      issues.push(`agent ${seed.id} has unknown maker ${seed.makerId}`);
      continue;
    }

    opts.orgs.addRole(seed.makerId, 'agent-maker');

    let vendors = (seed.vendors ?? []).filter(link => {
      if (opts.vendors.has(link.vendorId)) return true;

      issues.push(
        `agent ${seed.id} links vendor ${link.vendorId}, which is not in the catalog`
      );
      return false;
    });

    agents.push({
      id: seed.id,
      name: seed.name,
      makerId: seed.makerId,
      description: seed.description,
      website: seed.website ?? null,
      docs: seed.docs ?? null,
      repository: seed.repository ?? null,
      openSource: seed.openSource,
      license: seed.license ?? null,
      surfaces: [...seed.surfaces].sort(),
      aliases: [...new Set(seed.aliases ?? [])].sort(),
      vendors: vendors.sort(
        (a, b) =>
          vendorRoleOrder[a.role] - vendorRoleOrder[b.role] ||
          a.vendorId.localeCompare(b.vendorId)
      ),
      derivedFrom: seed.derivedFrom ?? null,
      status: seed.retired ? 'retired' : 'active'
    });
  }

  return { agents, issues };
};
