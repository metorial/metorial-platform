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

export type Applicator<Input, InitResult> = (
  input: Input,
  context: SerializerContext,
  initResult: InitResult
) => Promise<void>;
export type HashFunction<Input, InitResult> = (
  input: Input,
  initResult: InitResult
) => Promise<string>;

export type SerializerInputByTypeRaw = {
  skill: SkillSerializerInput;
  plugin: PluginSerializerInput;
  marketplace: MarketplaceSerializerInput;
};

export type SerializerInputByType<Type extends Serializer['type']> =
  SerializerInputByTypeRaw[Type];

export type GetApplicatorByType<Type extends Serializer['type'], InitResult> = Applicator<
  SerializerInputByType<Type>,
  InitResult
>;

export type GetHashFunctionByType<Type extends Serializer['type'], InitResult> = HashFunction<
  SerializerInputByType<Type>,
  InitResult
>;

export type Initializer<Type extends Serializer['type'], InitResult> = (
  input: SerializerInputByType<Type>
) => Promise<InitResult>;

export type SkillSerializer<InitResult = any> = {
  type: 'skill';
  init: Initializer<'skill', InitResult>;
  apply: GetApplicatorByType<'skill', InitResult>;
  getHash: GetHashFunctionByType<'skill', InitResult>;
};

export type PluginSerializer<InitResult = any> = {
  type: 'plugin';
  init: Initializer<'plugin', InitResult>;
  apply: GetApplicatorByType<'plugin', InitResult>;
  getHash: GetHashFunctionByType<'plugin', InitResult>;
};

export type MarketplaceSerializer<InitResult = any> = {
  type: 'marketplace';
  init: Initializer<'marketplace', InitResult>;
  apply: GetApplicatorByType<'marketplace', InitResult>;
  getHash: GetHashFunctionByType<'marketplace', InitResult>;
};

export type Serializer = SkillSerializer | PluginSerializer | MarketplaceSerializer;
