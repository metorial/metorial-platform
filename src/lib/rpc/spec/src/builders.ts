export type StringFormat = 'email' | 'url';

export type LiteralValue = string | number | boolean;

export type StringOptions = {
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: StringFormat;
};

export type NumberOptions = {
  min?: number;
  max?: number;
};

export type ArrayOptions = {
  minLength?: number;
  maxLength?: number;
};

export type TypeDef =
  | ({ kind: 'string' } & StringOptions)
  | { kind: 'boolean' }
  | ({ kind: 'int' } & NumberOptions)
  | ({ kind: 'number' } & NumberOptions)
  | { kind: 'datetime' }
  | { kind: 'bytes' }
  | { kind: 'json' }
  | { kind: 'void' }
  | { kind: 'literal'; value: LiteralValue }
  | { kind: 'enum'; values: readonly string[] }
  | ({ kind: 'array'; items: Type<any> } & ArrayOptions)
  | { kind: 'record'; values: Type<any> }
  | { kind: 'object'; fields: Readonly<Record<string, Type<any>>> }
  | {
      kind: 'union';
      discriminator: string;
      variants: Readonly<Record<string, Type<any>>>;
    }
  | { kind: 'lazy'; get: () => Type<any> };

export type TypeMeta = {
  name?: string;
  typeDescription?: string;
  typeDeprecated?: string;
  description?: string;
  deprecated?: string;
  examples?: unknown[];
  optional?: boolean;
  nullable?: boolean;
};

// `def` identity is what makes two usages the same named type: modifiers copy the meta but
// share the def, while `.named()` starts a new def so that distinct types can't share a name.
export class Type<T = unknown> {
  declare readonly __output: T;

  constructor(
    readonly def: TypeDef,
    readonly meta: TypeMeta = {}
  ) {}

  private with<U = T>(meta: Partial<TypeMeta>) {
    return new Type<U>(this.def, { ...this.meta, ...meta });
  }

  optional(): Type<T | undefined> {
    return this.with({ optional: true });
  }

  nullable(): Type<T | null> {
    return this.with({ nullable: true });
  }

  named(name: string): Type<T> {
    return new Type<T>(
      { ...this.def },
      {
        ...this.meta,
        name,
        typeDescription: this.meta.description,
        typeDeprecated: this.meta.deprecated,
        description: undefined,
        deprecated: undefined
      }
    );
  }

  description(description: string): Type<T> {
    return this.with({ description });
  }

  deprecated(reason = ''): Type<T> {
    return this.with({ deprecated: reason });
  }

  example(value: T): Type<T> {
    return this.with({ examples: [...(this.meta.examples ?? []), value] });
  }

  toRaw() {
    return { def: this.def, meta: this.meta };
  }
}

export type Infer<X extends Type<any>> = X['__output'];

type Simplify<T> = { [K in keyof T]: T[K] } & {};

type OptionalKeys<F> = {
  [K in keyof F]: F[K] extends Type<infer T> ? (undefined extends T ? K : never) : never;
}[keyof F];

type RequiredKeys<F> = Exclude<keyof F, OptionalKeys<F>>;

export type InferObject<F extends Record<string, Type<any>>> = Simplify<
  { [K in RequiredKeys<F>]: Infer<F[K]> } & {
    [K in OptionalKeys<F>]?: Exclude<Infer<F[K]>, undefined>;
  }
>;

export type InferUnion<D extends string, V extends Record<string, Type<any>>> = {
  [K in keyof V]: Simplify<{ [P in D]: K } & Infer<V[K]>>;
}[keyof V];

export let string = (opts: StringOptions = {}) => new Type<string>({ kind: 'string', ...opts });

export let boolean = () => new Type<boolean>({ kind: 'boolean' });

export let int = (opts: NumberOptions = {}) => new Type<number>({ kind: 'int', ...opts });

export let number = (opts: NumberOptions = {}) => new Type<number>({ kind: 'number', ...opts });

export let datetime = () => new Type<Date>({ kind: 'datetime' });

export let bytes = () => new Type<string>({ kind: 'bytes' });

export let json = () => new Type<unknown>({ kind: 'json' });

let voidType = () => new Type<void>({ kind: 'void' });

export { voidType as void };

export let literal = <const V extends LiteralValue>(value: V) =>
  new Type<V>({ kind: 'literal', value });

let enumType = <const V extends readonly [string, ...string[]]>(values: V) =>
  new Type<V[number]>({ kind: 'enum', values });

export { enumType as enum };

export let array = <I extends Type<any>>(items: I, opts: ArrayOptions = {}) =>
  new Type<Infer<I>[]>({ kind: 'array', items, ...opts });

export let record = <V extends Type<any>>(values: V) =>
  new Type<Record<string, Infer<V>>>({ kind: 'record', values });

export let object = <F extends Record<string, Type<any>>>(fields: F) =>
  new Type<InferObject<F>>({ kind: 'object', fields });

export let union = <const D extends string, V extends Record<string, Type<any>>>(
  discriminator: D,
  variants: V
) => new Type<InferUnion<D, V>>({ kind: 'union', discriminator, variants });

// Recursive specs need an explicit return type on the getter to break TypeScript's
// inference cycle: `t.lazy((): t.Type<FileEntry> => FileEntry)`.
export let lazy = <T>(get: () => Type<T>) => new Type<T>({ kind: 'lazy', get });
