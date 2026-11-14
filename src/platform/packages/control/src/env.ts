import type { RawEnv, RawEnvValue, Template } from './types';

export class InheritedEnv {
  readonly kind = 'inherit' as const;
}

export class FromEnv {
  readonly kind = 'from' as const;

  constructor(
    readonly name: string,
    readonly options: { required?: boolean; default?: string }
  ) {}
}

export type EnvValue = string | Template | InheritedEnv | FromEnv;
export type EnvInput = Record<string, EnvValue>;

export let inherit = () => new InheritedEnv();

export let fromEnv = (name: string, options: { required?: boolean; default?: string } = {}) =>
  new FromEnv(name, options);

export let mergeEnv = (...parts: EnvInput[]): EnvInput => {
  let result: EnvInput = {};

  for (let part of parts) {
    for (let [key, value] of Object.entries(part)) {
      if (Object.hasOwn(result, key))
        throw new Error(`environment key ${JSON.stringify(key)} is defined more than once`);
      result[key] = value;
    }
  }

  return result;
};

export let compileEnvValue = (value: EnvValue): RawEnvValue => {
  if (value instanceof InheritedEnv) return true;
  if (value instanceof FromEnv) return { from: value.name, ...value.options };
  return value;
};

export let compileEnv = (env: EnvInput): RawEnv =>
  Object.fromEntries(Object.entries(env).map(([key, value]) => [key, compileEnvValue(value)]));
