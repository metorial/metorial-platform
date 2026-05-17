import type {
  Skill,
  SkillConfiguration,
  SkillMarketplace,
  SkillMarketplacePlugin,
  SkillPlugin,
  SkillPluginSkill
} from '@metorial-cargo/db';

export type EnrichedSkillPluginSkill = SkillPluginSkill & {
  skill: Skill;
  skillConfiguration: SkillConfiguration | null;
};

export type EnrichedSkillPlugin = SkillPlugin & {
  skillConfiguration: SkillConfiguration | null;
  skills: EnrichedSkillPluginSkill[];
};

export type EnrichedSkillMarketplace = SkillMarketplace & {
  skillConfiguration: SkillConfiguration | null;
};

export type EnrichedSkillMarketplacePlugin = SkillMarketplacePlugin & {
  skillConfiguration: SkillConfiguration | null;
  plugin: EnrichedSkillPlugin;
};

export interface SkillSerializerInput {
  skill: Skill;
  skillPlugin: EnrichedSkillPlugin;
  skillPluginSkill: EnrichedSkillPluginSkill;
  skillMarketplace?: EnrichedSkillMarketplace;
  skillMarketplacePlugin?: EnrichedSkillMarketplacePlugin;
}

export interface PluginSerializerInput {
  skillPlugin: EnrichedSkillPlugin;
  skillMarketplace?: EnrichedSkillMarketplace;
  skillMarketplacePlugin?: EnrichedSkillMarketplacePlugin;
}

export interface MarketplaceSerializerInput {
  skillMarketplace: EnrichedSkillMarketplace;
}

export interface SerializerContext {
  setFile: (path: string, content: string | Buffer | ArrayBuffer) => Promise<void>;
  deletePath: (path: string) => Promise<void>;
  setBasePath: (path: string | undefined) => void;
}

export type SkillSerializer = {
  type: 'skill';
  apply: (input: SkillSerializerInput, context: SerializerContext) => Promise<void>;
  getHash: (input: SkillSerializerInput) => Promise<string>;
};

export type PluginSerializer = {
  type: 'plugin';
  apply: (input: PluginSerializerInput, context: SerializerContext) => Promise<void>;
  getHash: (input: PluginSerializerInput) => Promise<string>;
};

export type MarketplaceSerializer = {
  type: 'marketplace';
  apply: (input: MarketplaceSerializerInput, context: SerializerContext) => Promise<void>;
  getHash: (input: MarketplaceSerializerInput) => Promise<string>;
};

export type Serializer = SkillSerializer | PluginSerializer | MarketplaceSerializer;
