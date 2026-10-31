import { isOfflineMode, resolveOfflinePlaceholder } from '@lowerdeck/env';
import { v } from '@lowerdeck/validation';
import { getEdition } from '@metorial/editions';
import { loadConfigFile } from './file';
import { isSecretKey, registerSetting, type RegisteredSetting } from './registry';
import { isSettingDefinition } from './setting';
import {
  SettingsValidationError,
  type GroupSchema,
  type ResolvedGroup,
  type ResolvedGroups,
  type ResolvedSettings,
  type SettingDefinition,
  type SettingsIssue,
  type SettingsSchema
} from './types';

type PlannedSetting = {
  group: string;
  key: string;
  env: string;
  fileKeys: string[];
  definition: SettingDefinition;
};

type DefineSettings = {
  <G extends GroupSchema>(group: string, entries: G): ResolvedGroup<G>;
  <S extends SettingsSchema>(schema: S): ResolvedSettings<S>;
};

let planLegacy = (schema: SettingsSchema): PlannedSetting[] =>
  Object.entries(schema).flatMap(([group, entries]) =>
    Object.entries(entries).map(([key, entry]) => ({
      group,
      key,
      env: key,
      fileKeys: [key],
      definition: isSettingDefinition(entry)
        ? entry
        : ({
            kind: 'setting',
            validator: entry,
            options: {},
            scoped: false
          } as SettingDefinition)
    }))
  );

let planGrouped = (group: string, entries: GroupSchema): PlannedSetting[] =>
  Object.entries(entries).map(([key, definition]) => {
    let env = definition.options.env;

    if (!env) throw new Error(`Setting ${group}.${key} needs an env option`);

    return { group, key, env, fileKeys: [key, env], definition };
  });

let readFileValue = (file: Record<string, any>, planned: PlannedSetting) => {
  for (let fileKey of planned.fileKeys) {
    let value = file?.[planned.group]?.[fileKey];
    if (value !== undefined) return value;
  }

  return file?.[planned.env];
};

let readRaw = (
  planned: PlannedSetting,
  file: Record<string, any>,
  resolved: ResolvedGroups
): { raw: unknown; source: RegisteredSetting['source'] } => {
  let fromEnv = process.env[planned.env];
  if (fromEnv !== undefined) return { raw: fromEnv, source: 'env' };

  let fromFile = readFileValue(file, planned);
  if (fromFile !== undefined) return { raw: fromFile, source: 'file' };

  let fallback = planned.definition.options.default;

  if (fallback !== undefined) {
    let raw = typeof fallback == 'function' ? fallback(resolved) : fallback;
    return { raw, source: 'default' };
  }

  return { raw: undefined, source: 'unset' };
};

let resolveAll = (planned: PlannedSetting[]) => {
  let edition = getEdition();
  let file = loadConfigFile();

  let resolved: ResolvedGroups = {};
  let issues: SettingsIssue[] = [];

  for (let item of planned) {
    let { group, key, env, definition } = item;
    let { options } = definition;
    let optionalHere = !!options.requiredIn && !options.requiredIn.includes(edition);
    let validator = optionalHere ? v.optional(definition.validator) : definition.validator;

    resolved[group] ??= {};

    let staticDefault = typeof options.default == 'function' ? undefined : options.default;

    let base = {
      group,
      key,
      env,
      type: definition.validator.type,
      required: !validator.optional && options.default === undefined,
      audience: options.audience ?? ('deployment' as const),
      secret: options.secret ?? isSecretKey(env),
      description: options.description ?? definition.validator.description,
      editions: options.editions,
      defaultValue: staticDefault,
      derivedDefault: typeof options.default == 'function',
      example: definition.validator.examples?.[0]
    };

    if (options.editions && !options.editions.includes(edition)) {
      resolved[group][key] = undefined;
      registerSetting({ ...base, active: false, source: 'unset', value: undefined });
      continue;
    }

    let { raw, source } = readRaw(item, file, resolved);
    let result = validator.validate(definition.parse ? definition.parse(raw) : raw);

    if (!result.success && isOfflineMode()) {
      result = resolveOfflinePlaceholder(env, validator) ?? result;
    }

    if (!result.success) {
      let message = result.errors[0]?.message ?? 'invalid';

      issues.push({ group, key, env, audience: base.audience, message });
      registerSetting({
        ...base,
        active: true,
        source: 'unset',
        value: undefined,
        error: message
      });
      continue;
    }

    resolved[group][key] = result.value;
    registerSetting({ ...base, active: true, source, value: result.value });
  }

  if (issues.length && process.env.METORIAL_SETTINGS_MODE != 'collect') {
    throw new SettingsValidationError(issues);
  }

  return resolved;
};

export let defineSettings: DefineSettings = ((
  first: string | SettingsSchema,
  second?: GroupSchema
) => {
  if (typeof first == 'string') {
    return resolveAll(planGrouped(first, second ?? {}))[first] ?? {};
  }

  return resolveAll(planLegacy(first));
}) as DefineSettings;
