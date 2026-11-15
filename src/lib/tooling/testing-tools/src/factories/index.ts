export type Factory<T> = {
  build(overrides?: Partial<T>): T;
  create(overrides?: Partial<T>): Promise<T>;
};

export type FactoryOptions<T> = {
  persist?: (value: T) => Promise<T>;
  merge?: (base: T, overrides: Partial<T>) => T;
};

const defaultMerge = <T>(base: T, overrides: Partial<T>): T =>
  ({
    ...(base as Record<string, unknown>),
    ...(overrides as Record<string, unknown>)
  }) as T;

export const defineFactory = <T>(
  defaults: T | (() => T),
  options: FactoryOptions<T> = {}
): Factory<T> => {
  const merge = options.merge ?? defaultMerge;

  const resolveDefaults = (): T => {
    const value = typeof defaults === 'function' ? (defaults as () => T)() : defaults;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return { ...(value as Record<string, unknown>) } as T;
    }
    return value;
  };

  const build = (overrides: Partial<T> = {}): T => merge(resolveDefaults(), overrides);

  const create = async (overrides: Partial<T> = {}): Promise<T> => {
    const value = build(overrides);
    if (!options.persist) {
      return value;
    }
    return options.persist(value);
  };

  return {
    build,
    create
  };
};
