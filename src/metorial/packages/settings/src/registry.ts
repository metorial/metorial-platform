import { getEdition, type Edition } from '@metorial/editions';
import type { Audience } from './types';

export type RegisteredSetting = {
  group: string;
  key: string;
  env: string;
  type: string;
  required: boolean;
  audience: Audience;
  secret: boolean;
  description?: string;
  editions?: readonly Edition[];
  defaultValue?: unknown;
  derivedDefault: boolean;
  example?: unknown;
  active: boolean;
  source: 'env' | 'file' | 'default' | 'unset';
  value: unknown;
  error?: string;
};

export type SettingDescription = Omit<RegisteredSetting, 'value' | 'error'>;

let registered = new Map<string, RegisteredSetting>();

let secretKeyPattern =
  /(SECRET|PASSWORD|PASSPHRASE|TOKEN|PRIVATE_KEY|API_KEY|ACCESS_KEY|CREDENTIAL|DATABASE_URL|_PASS$|_DSN$)/;

export let isSecretKey = (key: string) => secretKeyPattern.test(key);

export let registerSetting = (setting: RegisteredSetting) => {
  registered.set(`${setting.group}.${setting.key}`, setting);
};

export let listSettings = () => [...registered.values()];

let preferGrouped = (a: RegisteredSetting, b: RegisteredSetting) =>
  Number(b.key != b.env) - Number(a.key != a.env);

let uniqueByEnv = (settings: RegisteredSetting[]) => {
  let byEnv = new Map<string, RegisteredSetting>();

  for (let setting of [...settings].sort(preferGrouped)) {
    if (!byEnv.has(setting.env)) byEnv.set(setting.env, setting);
  }

  return [...byEnv.values()];
};

export let listSettingIssues = () =>
  uniqueByEnv(listSettings().filter(setting => setting.active && setting.error)).map(
    setting => ({
      group: setting.group,
      key: setting.key,
      env: setting.env,
      audience: setting.audience,
      message: setting.error!
    })
  );

export let describeSettings = (filter: { audience?: Audience } = {}): SettingDescription[] =>
  uniqueByEnv(listSettings().filter(setting => setting.active))
    .filter(setting => !filter.audience || setting.audience == filter.audience)
    .map(({ value: _value, error: _error, ...setting }) => setting)
    .sort((a, b) => `${a.group}.${a.key}`.localeCompare(`${b.group}.${b.key}`));

export let dumpSettings = (options: { reveal?: boolean } = {}) =>
  Object.fromEntries(
    listSettings()
      .filter(setting => setting.active)
      .map(setting => [
        setting.env,
        {
          value:
            setting.secret && !options.reveal && setting.value !== undefined
              ? '[redacted]'
              : setting.value,
          source: setting.source
        }
      ])
  );

export let exportSettingsSchema = (filter: { audience?: Audience } = {}) => ({
  edition: getEdition(),
  settings: describeSettings(filter)
});

let placeholderFor = (setting: SettingDescription) => {
  if (setting.defaultValue !== undefined) return setting.defaultValue;
  if (setting.example !== undefined) return setting.example;
  if (setting.type == 'array') return [];
  if (setting.type == 'number') return 0;
  if (setting.type == 'boolean') return false;

  return 'REPLACE_ME';
};

export let renderExampleConfig = (
  filter: { audience?: Audience } = { audience: 'customer' }
) => {
  let byGroup = new Map<string, SettingDescription[]>();

  for (let setting of describeSettings(filter)) {
    byGroup.set(setting.group, [...(byGroup.get(setting.group) ?? []), setting]);
  }

  let lines: string[] = [];

  for (let [group, settings] of byGroup) {
    lines.push(`${group}:`);

    for (let setting of settings) {
      let notes = [setting.required ? 'required' : 'optional', `env: ${setting.env}`];
      if (setting.secret) notes.push('secret');

      if (setting.description) lines.push(`  # ${setting.description}`);
      lines.push(`  # ${notes.join(', ')}`);
      let line = `${setting.key}: ${JSON.stringify(placeholderFor(setting))}`;
      let unset = !setting.required && setting.defaultValue === undefined;

      lines.push(unset ? `  # ${line}` : `  ${line}`);
      lines.push('');
    }
  }

  return lines.join('\n').trimEnd() + '\n';
};

export let resetSettingsRegistry = () => {
  registered.clear();
};
