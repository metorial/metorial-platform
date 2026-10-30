import type { Edition } from '@metorial/editions';

export type RegisteredSetting = {
  group: string;
  key: string;
  type: string;
  optional: boolean;
  secret: boolean;
  description?: string;
  editions?: readonly Edition[];
  active: boolean;
  source: 'env' | 'file' | 'default' | 'unset';
  value: unknown;
};

let registered = new Map<string, RegisteredSetting>();

let secretKeyPattern =
  /(SECRET|PASSWORD|PASSPHRASE|TOKEN|PRIVATE_KEY|API_KEY|ACCESS_KEY|CREDENTIAL|DATABASE_URL|_PASS$|_DSN$)/;

export let isSecretKey = (key: string) => secretKeyPattern.test(key);

export let registerSetting = (setting: RegisteredSetting) => {
  registered.set(`${setting.group}.${setting.key}`, setting);
};

export let listSettings = () => [...registered.values()];

export let describeSettings = () =>
  listSettings()
    .filter(setting => setting.active)
    .map(({ value: _value, ...setting }) => setting)
    .sort((a, b) => a.key.localeCompare(b.key));

export let dumpSettings = (options: { reveal?: boolean } = {}) =>
  Object.fromEntries(
    listSettings()
      .filter(setting => setting.active)
      .map(setting => [
        setting.key,
        setting.secret && !options.reveal && setting.value !== undefined
          ? '[redacted]'
          : setting.value
      ])
  );

export let resetSettingsRegistry = () => {
  registered.clear();
};
