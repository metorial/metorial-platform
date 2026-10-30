import { v, type ValidationType } from '@lowerdeck/validation';
import type { Edition } from '@metorial/editions';
import type { SettingDefinition, SettingOptions } from './types';

type ScopedOptions<T> = SettingOptions<T> & { editions: readonly Edition[] };

type SettingFactory = {
  <T>(validator: ValidationType<T>, options: ScopedOptions<T>): SettingDefinition<T, true>;
  <T>(validator: ValidationType<T>, options?: SettingOptions<T>): SettingDefinition<T, false>;

  list: {
    <T>(item: ValidationType<T>, options: ScopedOptions<T[]>): SettingDefinition<T[], true>;
    <T>(item: ValidationType<T>, options?: SettingOptions<T[]>): SettingDefinition<T[], false>;
  };
};

let parseList = (raw: unknown) => {
  if (typeof raw != 'string') return raw;

  let trimmed = raw.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('[')) return JSON.parse(trimmed);

  return trimmed
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
};

let create = (
  validator: ValidationType<any>,
  options: SettingOptions<any> = {},
  parse?: (raw: unknown) => unknown
): SettingDefinition<any, any> => ({
  kind: 'setting',
  validator,
  options,
  scoped: !!options.editions,
  parse
});

export let setting: SettingFactory = Object.assign(
  (validator: ValidationType<any>, options?: SettingOptions<any>) =>
    create(validator, options),
  {
    list: (item: ValidationType<any>, options?: SettingOptions<any>) =>
      create(v.array(item), options, parseList)
  }
) as SettingFactory;

export let isSettingDefinition = (entry: unknown): entry is SettingDefinition =>
  typeof entry == 'object' && entry != null && (entry as any).kind == 'setting';
