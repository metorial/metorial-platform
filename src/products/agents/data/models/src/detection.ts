import { createHash } from 'node:crypto';
import { agentSeeds, type AgentSeed } from './registry/agents';
import {
  detectionSeeds,
  type DetectionPlatform,
  type DetectionSeed,
  type DetectionSignatures
} from './registry/detection';
import { organizationSeeds, type OrganizationSeed } from './registry/organizations';
import type { AgentSurface } from './types';

export type { DetectionPlatform } from './registry/detection';
export { agentSurfaces, type AgentSurface } from './types';

// Bumped when the shape of the published catalog changes, not when its entries do.
export let detectionCatalogSchema = 1;

export interface DetectionCatalogSignatures {
  config_dirs: string[];
  apps: string[];
  binaries: string[];
  process_names: string[];
}

export interface DetectionCatalogTool {
  key: string;
  name: string;
  description: string;
  maker: { id: string; name: string };
  website: string | null;
  surfaces: AgentSurface[];
  ide_extension_ids: string[];
  platforms: Record<DetectionPlatform, DetectionCatalogSignatures>;
}

export interface DetectionCatalog {
  schema: number;
  version: string;
  tools: DetectionCatalogTool[];
}

let sorted = (values: string[] | undefined) => [...new Set(values ?? [])].sort();

let presentSignatures = (signatures: DetectionSignatures | undefined) => ({
  config_dirs: sorted(signatures?.configDirs),
  apps: sorted(signatures?.apps),
  binaries: sorted(signatures?.binaries),
  process_names: sorted(signatures?.processNames)
});

export let buildDetectionCatalog = (
  opts: {
    seeds?: DetectionSeed[];
    agents?: AgentSeed[];
    organizations?: OrganizationSeed[];
  } = {}
): DetectionCatalog => {
  let agents = new Map((opts.agents ?? agentSeeds).map(agent => [agent.id, agent]));
  let organizations = new Map(
    (opts.organizations ?? organizationSeeds).map(organization => [
      organization.id,
      organization
    ])
  );

  let tools = (opts.seeds ?? detectionSeeds)
    .map(seed => {
      let agent = agents.get(seed.agentId);
      if (!agent) throw new Error(`detection seed ${seed.agentId} has no agent seed`);

      let maker = organizations.get(agent.makerId);
      if (!maker) throw new Error(`agent ${agent.id} has unknown maker ${agent.makerId}`);

      return {
        key: agent.id,
        name: agent.name,
        description: agent.description,
        maker: { id: maker.id, name: maker.name },
        website: agent.website ?? null,
        surfaces: [...agent.surfaces].sort(),
        ide_extension_ids: sorted(seed.ideExtensionIds),
        platforms: {
          macos: presentSignatures(seed.macos),
          windows: presentSignatures(seed.windows),
          linux: presentSignatures(seed.linux)
        }
      };
    })
    .sort((a, b) => a.key.localeCompare(b.key));

  let version = createHash('sha256')
    .update(JSON.stringify({ schema: detectionCatalogSchema, tools }))
    .digest('hex')
    .slice(0, 16);

  return { schema: detectionCatalogSchema, version, tools };
};

let cachedCatalog: DetectionCatalog | null = null;
let cachedTools: Map<string, DetectionCatalogTool> | null = null;

export let getDetectionCatalog = () => (cachedCatalog ??= buildDetectionCatalog());

export let findDetectionTool = (key: string) => {
  cachedTools ??= new Map(getDetectionCatalog().tools.map(tool => [tool.key, tool]));

  return cachedTools.get(key) ?? null;
};
