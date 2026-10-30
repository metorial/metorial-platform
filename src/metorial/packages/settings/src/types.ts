import type { ValidationType } from '@lowerdeck/validation';
import type { Edition } from '@metorial/editions';

export type ResolvedGroups = Record<string, Record<string, any>>;

export type SettingOptions<T> = {
  default?: T | ((resolved: ResolvedGroups) => T);
  secret?: boolean;
  description?: string;
  editions?: readonly Edition[];
};

export type SettingDefinition<T = any, Scoped extends boolean = boolean> = {
  kind: 'setting';
  validator: ValidationType<T>;
  options: SettingOptions<T>;
  scoped: Scoped;
  parse?: (raw: unknown) => unknown;
};

export type SettingEntry = ValidationType<any> | SettingDefinition<any>;

export type SettingsSchema = Record<string, Record<string, SettingEntry>>;

export type SettingValue<E> =
  E extends SettingDefinition<infer T, infer Scoped>
    ? Scoped extends true
      ? T | undefined
      : T
    : E extends ValidationType<infer T>
      ? T
      : never;

export type ResolvedSettings<S extends SettingsSchema> = {
  [G in keyof S]: { [K in keyof S[G]]: SettingValue<S[G][K]> };
};
