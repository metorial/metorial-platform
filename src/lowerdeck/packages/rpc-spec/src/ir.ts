import type { LiteralValue, StringFormat } from './builders';

export let irVersion = 1 as const;

export let maxSafeInteger = Number.MAX_SAFE_INTEGER;

export type IRType =
  | { kind: 'ref'; name: string }
  | { kind: 'nullable'; type: IRType }
  | {
      kind: 'string';
      minLength?: number;
      maxLength?: number;
      pattern?: string;
      format?: StringFormat;
    }
  | { kind: 'boolean' }
  | { kind: 'int'; min?: number; max?: number }
  | { kind: 'number'; min?: number; max?: number }
  | { kind: 'datetime' }
  | { kind: 'bytes' }
  | { kind: 'json' }
  | { kind: 'void' }
  | { kind: 'literal'; value: LiteralValue }
  | { kind: 'array'; items: IRType; minLength?: number; maxLength?: number }
  | { kind: 'record'; values: IRType };

export type IRField = {
  name: string;
  type: IRType;
  optional?: true;
  description?: string;
  deprecated?: string;
};

export type IRUnionVariant = { tag: string; type: string };

export type IRNamedTypeBody =
  | { kind: 'object'; fields: IRField[] }
  | { kind: 'enum'; values: string[] }
  | { kind: 'union'; discriminator: string; variants: IRUnionVariant[] }
  | { kind: 'alias'; type: IRType };

export type IRNamedType = IRNamedTypeBody & {
  name: string;
  description?: string;
  deprecated?: string;
};

export type IRError = {
  code: string;
  status: number;
  message: string;
  description?: string;
  data: IRField[];
};

export type IRMethod = {
  name: string;
  path: string[];
  input: IRType;
  output: IRType;
  errors: string[];
  description?: string;
  deprecated?: string;
};

export type IRService = {
  name: string;
  description?: string;
  go: { package: string };
  ts: { client: string };
};

export type IR = {
  irVersion: typeof irVersion;
  service: IRService;
  types: Record<string, IRNamedType>;
  errors: Record<string, IRError>;
  methods: IRMethod[];
};

export let resolveRef = (ir: IR, type: IRType) => {
  if (type.kind != 'ref') return undefined;

  let named = ir.types[type.name];
  if (!named) throw new Error(`Unknown type ${type.name}`);

  return named;
};
