import { isOfflineMode, resolveOfflinePlaceholder } from '@lowerdeck/env';
import { getEdition } from '@metorial/editions';
import { loadConfigFile, readConfigFileValue } from './file';
import { isSecretKey, registerSetting, type RegisteredSetting } from './registry';
import { isSettingDefinition } from './setting';
import type {
  ResolvedGroups,
  ResolvedSettings,
  SettingDefinition,
  SettingsSchema
} from './types';

let toDefinition = (entry: SettingsSchema[string][string]): SettingDefinition =>
  isSettingDefinition(entry)
    ? entry
    : { kind: 'setting', validator: entry as any, options: {}, scoped: false };

let readRaw = (
  definition: SettingDefinition,
  file: Record<string, any>,
  resolved: ResolvedGroups,
  group: string,
  key: string
): { raw: unknown; source: RegisteredSetting['source'] } => {
  let fromEnv = process.env[key];
  if (fromEnv !== undefined) return { raw: fromEnv, source: 'env' };

  let fromFile = readConfigFileValue(file, group, key);
  if (fromFile !== undefined) return { raw: fromFile, source: 'file' };

  let fallback = definition.options.default;

  if (fallback !== undefined) {
    let raw = typeof fallback == 'function' ? fallback(resolved) : fallback;
    return { raw, source: 'default' };
  }

  return { raw: undefined, source: 'unset' };
};

export let defineSettings = <S extends SettingsSchema>(schema: S): ResolvedSettings<S> => {
  let edition = getEdition();
  let file = loadConfigFile();

  let resolved: ResolvedGroups = {};
  let errors: string[] = [];

  for (let [group, entries] of Object.entries(schema)) {
    resolved[group] = {};

    for (let [key, entry] of Object.entries(entries)) {
      let definition = toDefinition(entry);
      let { options, validator } = definition;

      let base = {
        group,
        key,
        type: validator.type,
        optional: !!validator.optional || options.default !== undefined,
        secret: options.secret ?? isSecretKey(key),
        description: options.description ?? validator.description,
        editions: options.editions
      };

      if (options.editions && !options.editions.includes(edition)) {
        resolved[group]![key] = undefined;
        registerSetting({ ...base, active: false, source: 'unset', value: undefined });
        continue;
      }

      let { raw, source } = readRaw(definition, file, resolved, group, key);
      let input = definition.parse ? definition.parse(raw) : raw;
      let result = validator.validate(input);

      if (!result.success && isOfflineMode()) {
        result = resolveOfflinePlaceholder(key, validator) ?? result;
      }

      if (!result.success) {
        errors.push(`${key} - ${result.errors[0]?.message ?? 'invalid'}`);
        continue;
      }

      resolved[group]![key] = result.value;
      registerSetting({ ...base, active: true, source, value: result.value });
    }
  }

  if (errors.length) {
    throw new Error(`SETTINGS VALIDATION:\n${errors.map(error => `  ${error}`).join('\n')}`);
  }

  return resolved as ResolvedSettings<S>;
};
