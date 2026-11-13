import { Type, type TypeDef } from './builders';
import {
  irVersion,
  maxSafeInteger,
  type IR,
  type IRError,
  type IRField,
  type IRMethod,
  type IRNamedType,
  type IRNamedTypeBody,
  type IRType
} from './ir';
import { goName, pascalCase } from './names';
import { ErrorSpec, Method, ServiceSpec, type Methods } from './spec';

let methodSegmentPattern = /^[a-z][A-Za-z0-9]*$/;
let fieldNamePattern = /^[A-Za-z_][A-Za-z0-9_]*$/;
let typeNamePattern = /^[A-Z][A-Za-z0-9]*$/;
let errorCodePattern = /^[a-z][a-z0-9_]*$/;
let goPackagePattern = /^[a-z][a-z0-9]*$/;
let envelopeKeys = new Set(['$$TYPES$$', '$$MODE$$']);
let reservedErrorKeys = new Set([
  'object',
  'ok',
  'status',
  'code',
  'message',
  'hint',
  'description',
  'reason',
  'errors',
  'entity'
]);
let reservedGoNames = new Set(['Service', 'Client', 'NewClient', 'Register']);
let unsupportedPatternSyntax = /\(\?<?[=!]|\\[1-9]|\\k</;

export class SpecError extends Error {
  constructor(readonly issues: { path: string; message: string }[]) {
    super(
      `Invalid RPC spec:\n${issues.map(issue => `  ${issue.path}: ${issue.message}`).join('\n')}`
    );
    this.name = 'SpecError';
  }
}

type Frame = { name: string; indirect: boolean };

type Context = {
  path: string;
  suggestedName: string;
  allowOptional?: boolean;
  allowVoid?: boolean;
};

class Compiler {
  issues: { path: string; message: string }[] = [];
  types = new Map<string, { def: TypeDef; ir?: IRNamedType; path: string }>();
  typeOrder: string[] = [];
  anonymousNames = new Map<TypeDef, string>();
  errors = new Map<string, { spec: ErrorSpec; ir: IRError }>();
  stack: Frame[] = [];

  fail(path: string, message: string) {
    this.issues.push({ path, message });
  }

  compileType(type: Type<any>, ctx: Context): IRType {
    let { def, meta } = type;

    if (meta.optional && !ctx.allowOptional) {
      this.fail(ctx.path, '.optional() is only allowed on object fields');
    }

    let inner = this.compileInner(type, ctx);

    if (!meta.nullable || def.kind == 'json') return inner;
    if (def.kind == 'void') {
      this.fail(ctx.path, 't.void() cannot be nullable');
      return inner;
    }

    return { kind: 'nullable', type: inner };
  }

  private compileInner(type: Type<any>, ctx: Context): IRType {
    let { def, meta } = type;

    if (def.kind == 'lazy') return this.compileLazy(def.get, ctx);

    if (def.kind == 'void') {
      if (!ctx.allowVoid) this.fail(ctx.path, 't.void() is only allowed as a method input or output');
      return { kind: 'void' };
    }

    let hoisted = def.kind == 'object' || def.kind == 'enum' || def.kind == 'union';
    if (!hoisted && !meta.name) return this.compileInline(def, ctx);

    if (meta.name) return this.compileNamed(meta.name, type, ctx);

    let reused = this.anonymousNames.get(def);
    if (reused) return { kind: 'ref', name: reused };

    this.anonymousNames.set(def, ctx.suggestedName);
    return this.compileNamed(ctx.suggestedName, type, ctx);
  }

  private compileLazy(get: () => Type<any>, ctx: Context): IRType {
    let target: Type<any>;
    try {
      target = get();
    } catch (err) {
      this.fail(ctx.path, `t.lazy() getter threw: ${(err as Error).message}`);
      return { kind: 'json' };
    }

    if (!(target instanceof Type) || !target.meta.name) {
      this.fail(ctx.path, 't.lazy() must point to a type with .named()');
      return { kind: 'json' };
    }

    let name = target.meta.name;
    let frameIndex = this.stack.findIndex(frame => frame.name == name);
    if (frameIndex != -1 && !this.stack.slice(frameIndex).some(frame => frame.indirect)) {
      this.fail(
        ctx.path,
        `${name} contains itself without an array, record, union, optional or nullable in between, so no finite value exists`
      );
    }

    return this.compileNamed(name, target, ctx);
  }

  private compileNamed(name: string, type: Type<any>, ctx: Context): IRType {
    let ref: IRType = { kind: 'ref', name };

    if (!typeNamePattern.test(name)) {
      this.fail(ctx.path, `type name ${JSON.stringify(name)} must be PascalCase`);
      return ref;
    }

    let existing = this.types.get(name);
    if (existing) {
      if (existing.def !== type.def) {
        let hint = type.meta.name ? '' : ' Give one of them a distinct name with .named().';
        this.fail(ctx.path, `type name ${name} is already used at ${existing.path}.${hint}`);
      }
      return ref;
    }

    this.types.set(name, { def: type.def, path: ctx.path });
    this.typeOrder.push(name);

    this.stack.push({ name, indirect: false });
    let body = this.compileBody(name, type, ctx);
    this.stack.pop();

    let ir: IRNamedType = { name, ...body };
    if (type.meta.typeDescription) ir.description = type.meta.typeDescription;
    if (type.meta.typeDeprecated !== undefined) ir.deprecated = type.meta.typeDeprecated;
    this.types.get(name)!.ir = ir;

    return ref;
  }

  private compileBody(name: string, type: Type<any>, ctx: Context): IRNamedTypeBody {
    let { def } = type;

    if (def.kind == 'object') {
      return { kind: 'object', fields: this.compileFields(def.fields, name, ctx.path) };
    }

    if (def.kind == 'enum') return { kind: 'enum', values: this.checkEnum(def.values, name, ctx) };

    if (def.kind == 'union') return this.compileUnion(def, name, ctx);

    return { kind: 'alias', type: this.compileInline(def, { ...ctx, suggestedName: name }) };
  }

  compileFields(fields: Readonly<Record<string, Type<any>>>, owner: string, path: string) {
    let goNames = new Map<string, string>();
    let out: IRField[] = [];

    for (let [key, fieldType] of Object.entries(fields)) {
      let fieldPath = `${path}.${key}`;

      if (!(fieldType instanceof Type)) {
        this.fail(fieldPath, 'field is not a t.* type');
        continue;
      }

      if (envelopeKeys.has(key)) {
        this.fail(fieldPath, `${key} is reserved by the serialize envelope`);
      } else if (!fieldNamePattern.test(key)) {
        this.fail(fieldPath, 'field names must be identifiers ([A-Za-z_][A-Za-z0-9_]*)');
      }

      let go = goName(key);
      let clash = goNames.get(go);
      if (clash) this.fail(fieldPath, `field maps to the same Go name (${go}) as ${clash}`);
      goNames.set(go, key);

      let frame = this.stack[this.stack.length - 1];
      let wasIndirect = frame?.indirect;
      if (frame && (fieldType.meta.optional || fieldType.meta.nullable)) frame.indirect = true;

      let type = this.compileType(fieldType, {
        path: fieldPath,
        suggestedName: `${owner}${pascalCase(key)}`,
        allowOptional: true
      });

      if (frame) frame.indirect = wasIndirect!;

      let field: IRField = { name: key, type };
      if (fieldType.meta.optional) field.optional = true;
      if (fieldType.meta.description) field.description = fieldType.meta.description;
      if (fieldType.meta.deprecated !== undefined) field.deprecated = fieldType.meta.deprecated;
      out.push(field);
    }

    return out;
  }

  private checkEnum(values: readonly string[], name: string, ctx: Context) {
    if (!values.length) this.fail(ctx.path, 't.enum() needs at least one value');

    let constants = new Map<string, string>();
    for (let value of values) {
      if (typeof value != 'string') {
        this.fail(ctx.path, `enum values must be strings, got ${JSON.stringify(value)}`);
        continue;
      }

      let constant = goName(value);
      if (!constant) {
        this.fail(ctx.path, `enum value ${JSON.stringify(value)} has no letters or digits`);
        continue;
      }

      let clash = constants.get(constant);
      if (clash !== undefined) {
        this.fail(
          ctx.path,
          `enum values ${JSON.stringify(clash)} and ${JSON.stringify(value)} map to the same Go constant ${name}${constant}`
        );
      }
      constants.set(constant, value);
    }

    return [...values];
  }

  private compileUnion(
    def: Extract<TypeDef, { kind: 'union' }>,
    name: string,
    ctx: Context
  ): IRNamedTypeBody {
    if (!fieldNamePattern.test(def.discriminator)) {
      this.fail(ctx.path, 'the union discriminator must be an identifier');
    }

    let entries = Object.entries(def.variants);
    if (!entries.length) this.fail(ctx.path, 't.union() needs at least one variant');

    let frame = this.stack[this.stack.length - 1]!;
    frame.indirect = true;

    let tags = new Map<string, string>();
    let variants = entries.flatMap(([tag, variant]) => {
      let variantPath = `${ctx.path}.${tag}`;

      let suffix = pascalCase(tag);
      if (!suffix) this.fail(variantPath, 'variant tags need letters or digits');
      let clash = tags.get(suffix);
      if (clash !== undefined) {
        this.fail(variantPath, `variant tag maps to the same type name as ${JSON.stringify(clash)}`);
      }
      tags.set(suffix, tag);

      if (!(variant instanceof Type) || variant.def.kind != 'object') {
        this.fail(variantPath, 'union variants must be t.object() types');
        return [];
      }
      if (variant.meta.optional || variant.meta.nullable) {
        this.fail(variantPath, 'union variants cannot be optional or nullable');
      }
      if (def.discriminator in variant.def.fields) {
        this.fail(
          `${variantPath}.${def.discriminator}`,
          'variants must not declare the discriminator field; it is added from the tag'
        );
      }

      let ref = this.compileType(variant, {
        path: variantPath,
        suggestedName: `${name}${suffix}`
      });
      return ref.kind == 'ref' ? [{ tag, type: ref.name }] : [];
    });

    return { kind: 'union', discriminator: def.discriminator, variants };
  }

  private compileInline(def: TypeDef, ctx: Context): IRType {
    switch (def.kind) {
      case 'string': {
        let out: IRType = { kind: 'string' };
        this.checkLength(def, ctx);
        if (def.minLength !== undefined) out.minLength = def.minLength;
        if (def.maxLength !== undefined) out.maxLength = def.maxLength;
        if (def.pattern !== undefined) {
          this.checkPattern(def.pattern, ctx);
          out.pattern = def.pattern;
        }
        if (def.format !== undefined) {
          if (def.format != 'email' && def.format != 'url') {
            this.fail(ctx.path, `unknown string format ${JSON.stringify(def.format)}`);
          }
          out.format = def.format;
        }
        return out;
      }

      case 'int':
      case 'number': {
        let out: IRType = { kind: def.kind };
        for (let bound of ['min', 'max'] as const) {
          let value = def[bound];
          if (value === undefined) continue;

          if (!Number.isFinite(value)) this.fail(ctx.path, `${bound} must be a finite number`);
          if (def.kind == 'int' && (!Number.isInteger(value) || Math.abs(value) > maxSafeInteger)) {
            this.fail(ctx.path, `${bound} must be an integer within ±(2^53 - 1)`);
          }
          out[bound] = value;
        }
        if (def.min !== undefined && def.max !== undefined && def.min > def.max) {
          this.fail(ctx.path, 'min must not be greater than max');
        }
        return out;
      }

      case 'literal': {
        let valid =
          typeof def.value == 'string' ||
          typeof def.value == 'boolean' ||
          (typeof def.value == 'number' && Number.isFinite(def.value));
        if (!valid) this.fail(ctx.path, 'literals must be strings, finite numbers or booleans');
        return { kind: 'literal', value: def.value };
      }

      case 'array': {
        this.checkLength(def, ctx);

        let frame = this.stack[this.stack.length - 1];
        let wasIndirect = frame?.indirect;
        if (frame) frame.indirect = true;

        let items = this.compileType(def.items, {
          path: `${ctx.path}[]`,
          suggestedName: `${ctx.suggestedName}Item`
        });

        if (frame) frame.indirect = wasIndirect!;

        let out: IRType = { kind: 'array', items };
        if (def.minLength !== undefined) out.minLength = def.minLength;
        if (def.maxLength !== undefined) out.maxLength = def.maxLength;
        return out;
      }

      case 'record': {
        let frame = this.stack[this.stack.length - 1];
        let wasIndirect = frame?.indirect;
        if (frame) frame.indirect = true;

        let values = this.compileType(def.values, {
          path: `${ctx.path}{}`,
          suggestedName: `${ctx.suggestedName}Value`
        });

        if (frame) frame.indirect = wasIndirect!;
        return { kind: 'record', values };
      }

      case 'boolean':
      case 'datetime':
      case 'bytes':
      case 'json':
        return { kind: def.kind };

      default:
        this.fail(ctx.path, `unsupported type ${def.kind}`);
        return { kind: 'json' };
    }
  }

  private checkLength(def: { minLength?: number; maxLength?: number }, ctx: Context) {
    for (let bound of ['minLength', 'maxLength'] as const) {
      let value = def[bound];
      if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
        this.fail(ctx.path, `${bound} must be a non-negative integer`);
      }
    }
    if (
      def.minLength !== undefined &&
      def.maxLength !== undefined &&
      def.minLength > def.maxLength
    ) {
      this.fail(ctx.path, 'minLength must not be greater than maxLength');
    }
  }

  private checkPattern(pattern: string, ctx: Context) {
    try {
      new RegExp(pattern);
    } catch {
      this.fail(ctx.path, `pattern ${JSON.stringify(pattern)} is not a valid regular expression`);
      return;
    }

    if (unsupportedPatternSyntax.test(pattern)) {
      this.fail(
        ctx.path,
        'patterns must be RE2-compatible (no lookaround or backreferences) so Go can check them'
      );
    }
  }

  compileError(spec: ErrorSpec, path: string) {
    let { def } = spec;
    let existing = this.errors.get(def.code);
    if (existing) {
      if (existing.spec !== spec) {
        this.fail(path, `error code ${def.code} is declared twice with different definitions`);
      }
      return def.code;
    }

    if (!errorCodePattern.test(def.code)) this.fail(path, 'error codes must be snake_case');
    if (!Number.isInteger(def.status) || def.status < 400 || def.status > 599) {
      this.fail(path, 'error status must be between 400 and 599');
    }

    for (let key of Object.keys(def.data ?? {})) {
      if (reservedErrorKeys.has(key)) {
        this.fail(`${path}.data.${key}`, `${key} is a reserved error field`);
      }
    }

    let ir: IRError = {
      code: def.code,
      status: def.status,
      message: def.message,
      data: this.compileFields(
        def.data ?? {},
        `${pascalCase(def.code)}ErrorData`,
        `${path}.data`
      )
    };
    if (def.description) ir.description = def.description;

    this.errors.set(def.code, { spec, ir });
    return def.code;
  }
}

let collectMethods = (
  methods: Methods,
  prefix: string[],
  out: { path: string[]; method: Method }[],
  compiler: Compiler
) => {
  for (let [key, value] of Object.entries(methods)) {
    let path = [...prefix, key];

    if (!methodSegmentPattern.test(key)) {
      compiler.fail(`methods.${path.join('.')}`, 'method and namespace names must match [a-z][A-Za-z0-9]*');
    }

    if (value instanceof Method) out.push({ path, method: value });
    else if (value && typeof value == 'object') collectMethods(value, path, out, compiler);
    else compiler.fail(`methods.${path.join('.')}`, 'expected a method() or a namespace object');
  }

  return out;
};

let checkIO = (compiler: Compiler, ir: IRType, path: string, isInput: boolean) => {
  if (ir.kind == 'void') return;

  let named = ir.kind == 'ref' ? compiler.types.get(ir.name)?.ir : undefined;
  if (!named || (named.kind != 'object' && named.kind != 'union')) {
    compiler.fail(
      path,
      'method inputs and outputs must be objects, discriminated unions or t.void() (protocol §4.4)'
    );
    return;
  }

  if (!isInput) return;

  let hasCalls =
    named.kind == 'object'
      ? named.fields.some(field => field.name == 'calls')
      : named.discriminator == 'calls' ||
        named.variants.some(variant => {
          let body = compiler.types.get(variant.type)?.ir;
          return body?.kind == 'object' && body.fields.some(field => field.name == 'calls');
        });

  if (hasCalls) {
    compiler.fail(
      `${path}.calls`,
      'a top-level "calls" input field would be read as a batch envelope (protocol §5.3)'
    );
  }
};

export let compile = (spec: ServiceSpec<any>): IR => {
  if (!(spec instanceof ServiceSpec)) throw new Error('compile() expects a service() spec');

  let compiler = new Compiler();
  let def = spec.def;

  if (!/^[a-z][a-z0-9-]*$/.test(def.name)) compiler.fail('name', 'service names must be kebab-case');
  if (!goPackagePattern.test(def.go?.package ?? '')) {
    compiler.fail('go.package', 'Go package names must be lowercase letters and digits');
  }
  if (!typeNamePattern.test(def.ts?.client ?? '')) {
    compiler.fail('ts.client', 'the TypeScript client type name must be PascalCase');
  }

  let methods: IRMethod[] = [];
  let goMethods = new Map<string, string>();

  for (let { path, method } of collectMethods(def.methods, [], [], compiler)) {
    let methodPath = `methods.${path.join('.')}`;
    let base = path.map(segment => pascalCase(segment)).join('');

    let go = path.map(segment => goName(segment)).join('');
    let clash = goMethods.get(go);
    if (clash) compiler.fail(methodPath, `maps to the same Go method (${go}) as ${clash}`);
    goMethods.set(go, methodPath);

    let input = compiler.compileType(method.def.input, {
      path: `${methodPath}.input`,
      suggestedName: `${base}Input`,
      allowVoid: true
    });
    let output = compiler.compileType(method.def.output, {
      path: `${methodPath}.output`,
      suggestedName: `${base}Output`,
      allowVoid: true
    });

    let errors = (method.def.errors ?? []).map((spec, i) =>
      spec instanceof ErrorSpec
        ? compiler.compileError(spec, `${methodPath}.errors[${i}]`)
        : (compiler.fail(`${methodPath}.errors[${i}]`, 'expected an error() spec'), '')
    );

    let ir: IRMethod = { name: path.join(':'), path, input, output, errors };
    if (method.def.description) ir.description = method.def.description;
    if (method.def.deprecated !== undefined) ir.deprecated = method.def.deprecated;
    methods.push(ir);
  }

  for (let method of methods) {
    let methodPath = `methods.${method.path.join('.')}`;
    checkIO(compiler, method.input, `${methodPath}.input`, true);
    checkIO(compiler, method.output, `${methodPath}.output`, false);
  }

  let reserved = new Set([...reservedGoNames, def.ts?.client]);
  for (let [name, entry] of compiler.types) {
    if (reserved.has(name)) {
      compiler.fail(entry.path, `type name ${name} is reserved for generated code`);
    }
    if (entry.ir?.kind == 'union' && compiler.types.has(`${name}Variant`)) {
      compiler.fail(entry.path, `type name ${name}Variant is reserved for the union ${name}`);
    }
  }

  if (compiler.issues.length) throw new SpecError(compiler.issues);

  let ir: IR = {
    irVersion,
    service: {
      name: def.name,
      go: { package: def.go.package },
      ts: { client: def.ts.client }
    },
    types: Object.fromEntries(
      compiler.typeOrder.map(name => [name, compiler.types.get(name)!.ir!])
    ),
    errors: Object.fromEntries([...compiler.errors].map(([code, entry]) => [code, entry.ir])),
    methods
  };
  if (def.description) ir.service.description = def.description;

  return ir;
};
