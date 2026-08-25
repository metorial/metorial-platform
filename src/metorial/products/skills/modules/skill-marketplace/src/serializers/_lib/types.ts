import type {
  File as MetorialFile,
  Skill,
  SkillConfiguration,
  SkillMarketplace,
  SkillMarketplacePlugin,
  SkillPlugin,
  SkillPluginSkill
} from '@metorial/db';

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

  /**
   * Writes a path from a file that already lives in object storage.
   *
   * Prefer this over reading the file and calling `setFile`: stored files are
   * immutable, so an unchanged path is detected from the file's identity alone,
   * and a changed one is copied storage-side rather than passing through this
   * process. Content that has not been flushed to object storage yet is handled
   * transparently, and is small by construction.
   */
  setFileFromStorage: (path: string, file: StorageBackedFile) => Promise<void>;

  deletePath: (path: string) => Promise<void>;
  setBasePath: (path: string | undefined) => void;
}

export type StorageBackedFile = Pick<
  MetorialFile,
  'oid' | 'status' | 'storeId' | 'fileSize'
>;

/**
 * The subtree a serializer owns. After it runs, anything under `prefix` that it
 * did not write is stale and gets removed, except under `excludePrefixes`,
 * which are owned by a different serializer. Both are relative to the bucket
 * root; `excludePrefixes` are relative to `prefix`.
 */
export interface PruneScope {
  prefix: string;
  excludePrefixes: string[];
}

export type PruneScopeFunction<Input> = (input: Input) => PruneScope;

export type GetPruneScopeByType<Type extends Serializer['type']> = PruneScopeFunction<
  SerializerInputByType<Type>
>;

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
  getPruneScope?: GetPruneScopeByType<'skill'>;
};

export type PluginSerializer<InitResult = any> = {
  type: 'plugin';
  init: Initializer<'plugin', InitResult>;
  apply: GetApplicatorByType<'plugin', InitResult>;
  getHash: GetHashFunctionByType<'plugin', InitResult>;
  getPruneScope?: GetPruneScopeByType<'plugin'>;
};

export type MarketplaceSerializer<InitResult = any> = {
  type: 'marketplace';
  init: Initializer<'marketplace', InitResult>;
  apply: GetApplicatorByType<'marketplace', InitResult>;
  getHash: GetHashFunctionByType<'marketplace', InitResult>;
  getPruneScope?: GetPruneScopeByType<'marketplace'>;
};

export type Serializer = SkillSerializer | PluginSerializer | MarketplaceSerializer;
