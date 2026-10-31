import type { ValidationType } from '@lowerdeck/validation';
import type { Edition } from '@metorial/editions';

export type Audience = 'customer' | 'derived' | 'deployment';

export type ResolvedGroups = Record<string, Record<string, any>>;

export type SettingOptions<T> = {
  env?: string;
  default?: NoInfer<T> | undefined | ((resolved: ResolvedGroups) => NoInfer<T> | undefined);
  audience?: Audience;
  secret?: boolean;
  description?: string;
  editions?: readonly Edition[];
  requiredIn?: readonly Edition[];
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

export type GroupSchema = Record<string, SettingDefinition<any>>;

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

export type ResolvedGroup<G extends GroupSchema> = {
  [K in keyof G]: SettingValue<G[K]>;
};

export type SettingsIssue = {
  group: string;
  key: string;
  env: string;
  audience: Audience;
  message: string;
};

export class SettingsValidationError extends Error {
  constructor(readonly issues: SettingsIssue[]) {
    super(`SETTINGS VALIDATION:\n${issues.map(i => `  ${i.env} - ${i.message}`).join('\n')}`);
    this.name = 'SettingsValidationError';
  }
}
