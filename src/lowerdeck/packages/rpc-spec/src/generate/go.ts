import type { IR, IRError, IRField, IRMethod, IRNamedType, IRType } from '../ir';
import { goName, goParamName } from '../names';

export type GoGeneratorOptions = {
  ldrpcImport?: string;
};

let defaultLdrpcImport = 'github.com/metorial/metorial-platform/src/lowerdeck/go/ldrpc';
let standardErrorSetters: Record<string, string> = {
  hint: 'WithHint',
  description: 'WithDescription',
  reason: 'WithReason'
};

type Line = string | string[];

// Mirrors gofmt's tabwriter: a column is padded across a run of consecutive lines that all
// have a cell after it. Plain string lines (comments, blank lines) end every run.
let align = (lines: Line[], indent: string) => {
  let widths = lines.map(line => (Array.isArray(line) ? line.map(() => 0) : []));
  let columns = Math.max(0, ...lines.map(line => (Array.isArray(line) ? line.length : 0)));

  for (let column = 0; column < columns - 1; column++) {
    let start = 0;
    while (start < lines.length) {
      let hasCell = (i: number) => {
        let line = lines[i];
        return Array.isArray(line) && line.length > column + 1;
      };
      if (!hasCell(start)) {
        start++;
        continue;
      }

      let end = start;
      while (end < lines.length && hasCell(end)) end++;

      let width = Math.max(
        ...lines.slice(start, end).map(line => [...(line as string[])[column]!].length)
      );
      for (let i = start; i < end; i++) widths[i]![column] = width;
      start = end;
    }
  }

  return lines.map((line, i) => {
    if (!Array.isArray(line)) return line ? `${indent}${line}` : '';
    let text = line
      .map((cell, column) =>
        column < line.length - 1
          ? cell + ' '.repeat(widths[i]![column]! - [...cell].length + 1)
          : cell
      )
      .join('');
    return `${indent}${text}`;
  });
};

let docLines = (text?: string, deprecated?: string) => {
  let lines = text ? text.split('\n').map(line => (line ? `// ${line}` : '//')) : [];
  if (deprecated !== undefined) {
    if (lines.length) lines.push('//');
    lines.push(deprecated ? `// Deprecated: ${deprecated}` : '// Deprecated: do not use.');
  }
  return lines;
};

let goString = (value: string) => JSON.stringify(value);

class GoGenerator {
  imports = new Set<string>(['context']);
  identifiers = new Map<string, string>();

  constructor(
    readonly ir: IR,
    readonly opts: GoGeneratorOptions
  ) {
    for (let name of ['Service', 'Register', 'Client', 'NewClient', 'WrapClient']) {
      this.identifiers.set(name, 'generated code');
    }
    for (let name of Object.keys(ir.types)) this.claim(name, `type ${name}`);
  }

  claim(name: string, owner: string) {
    let existing = this.identifiers.get(name);
    if (existing) {
      throw new Error(`Go identifier ${name} is used by both ${existing} and ${owner}`);
    }
    this.identifiers.set(name, owner);
  }

  named(name: string) {
    let type = this.ir.types[name];
    if (!type) throw new Error(`Unknown type ${name}`);
    return type;
  }

  // Types whose Go zero value is nil, so they need no extra pointer to be nullable.
  isNilable(type: IRType): boolean {
    switch (type.kind) {
      case 'array':
      case 'record':
      case 'bytes':
      case 'json':
        return true;
      case 'ref': {
        let named = this.named(type.name);
        return named.kind == 'alias' && this.isNilable(named.type);
      }
      default:
        return false;
    }
  }

  // Required slices and maps are sent as []/{} rather than null when left nil.
  needsNonNil(type: IRType): boolean {
    switch (type.kind) {
      case 'array':
      case 'record':
      case 'bytes':
        return true;
      case 'ref': {
        let named = this.named(type.name);
        return named.kind == 'alias' && this.needsNonNil(named.type);
      }
      default:
        return false;
    }
  }

  type(type: IRType): string {
    switch (type.kind) {
      case 'ref':
        return type.name;
      case 'nullable':
        return this.isNilable(type.type) ? this.type(type.type) : `*${this.type(type.type)}`;
      case 'string':
        return 'string';
      case 'boolean':
        return 'bool';
      case 'int':
        return 'int64';
      case 'number':
        return 'float64';
      case 'datetime':
        this.imports.add('time');
        return 'time.Time';
      case 'bytes':
        return '[]byte';
      case 'json':
        this.imports.add('encoding/json');
        return 'json.RawMessage';
      case 'void':
        return 'ldrpc.Void';
      case 'literal':
        return typeof type.value == 'string'
          ? 'string'
          : typeof type.value == 'boolean'
            ? 'bool'
            : 'float64';
      case 'array':
        return `[]${this.type(type.items)}`;
      case 'record':
        return `map[string]${this.type(type.values)}`;
    }
  }

  fieldType(field: IRField) {
    let nullable = field.type.kind == 'nullable';
    let base = field.type.kind == 'nullable' ? field.type.type : field.type;

    if (field.optional || nullable) {
      return this.isNilable(base) ? this.type(base) : `*${this.type(base)}`;
    }
    return this.type(base);
  }

  fieldTag(field: IRField) {
    if (field.optional) return `\`json:"${field.name},omitempty"\``;
    if (field.type.kind != 'nullable' && this.needsNonNil(field.type)) {
      return `\`json:"${field.name}" ldrpc:"nonnil"\``;
    }
    return `\`json:"${field.name}"\``;
  }

  struct(fields: IRField[]) {
    if (!fields.length) return 'struct{}';

    let lines: Line[] = [];
    for (let field of fields) {
      let doc = docLines(field.description, field.deprecated);
      lines.push(...doc);
      lines.push([goName(field.name), this.fieldType(field), this.fieldTag(field)]);
    }
    return `struct {\n${align(lines, '\t').join('\n')}\n}`;
  }

  namedType(type: IRNamedType) {
    let doc = docLines(type.description, type.deprecated);
    let out: string[] = [];

    switch (type.kind) {
      case 'object':
        out.push(`type ${type.name} ${this.struct(type.fields)}`);
        break;

      case 'enum': {
        out.push(`type ${type.name} string`);
        let constants = type.values.map(value => {
          let name = `${type.name}${goName(value)}`;
          this.claim(name, `the ${type.name} value ${JSON.stringify(value)}`);
          return [name, type.name, `= ${goString(value)}`];
        });
        out.push(`const (\n${align(constants, '\t').join('\n')}\n)`);
        break;
      }

      case 'alias': {
        let inner = type.type;
        let asAlias =
          inner.kind == 'datetime' ||
          inner.kind == 'json' ||
          inner.kind == 'nullable' ||
          inner.kind == 'ref';
        out.push(`type ${type.name} ${asAlias ? '= ' : ''}${this.type(inner)}`);
        break;
      }

      case 'union':
        out.push(...this.union(type));
        break;
    }

    if (doc.length) out[0] = `${doc.join('\n')}\n${out[0]}`;
    return out.join('\n\n');
  }

  union(type: Extract<IRNamedType, { kind: 'union' }>) {
    let variantInterface = `${type.name}Variant`;
    let marker = `is${type.name}`;
    let discriminator = goString(type.discriminator);
    this.claim(variantInterface, `the ${type.name} union`);
    this.imports.add('encoding/json');
    this.imports.add('fmt');

    let markers = type.variants.map(variant => `func (*${variant.type}) ${marker}() {}`);

    let unionVariantCases = type.variants
      .map(
        variant =>
          `\tcase *${variant.type}:\n\t\treturn ${discriminator}, ${goString(variant.tag)}, v`
      )
      .join('\n');

    let decodeCases = type.variants
      .map(
        variant =>
          `\tcase ${goString(variant.tag)}:\n\t\tv := new(${variant.type})\n\t\tif err := json.Unmarshal(data, v); err != nil {\n\t\t\treturn err\n\t\t}\n\t\tu.Variant = v`
      )
      .join('\n');

    return [
      `type ${variantInterface} interface {\n\t${marker}()\n}`,
      `type ${type.name} struct {\n\tVariant ${variantInterface}\n}`,
      markers.join('\n\n'),
      `func (u ${type.name}) UnionVariant() (string, string, any) {\n\tswitch v := u.Variant.(type) {\n${unionVariantCases}\n\t}\n\treturn ${discriminator}, "", nil\n}`,
      `func (u ${type.name}) MarshalJSON() ([]byte, error) {\n\treturn ldrpc.MarshalUnion(u)\n}`,
      `func (u *${type.name}) UnmarshalJSON(data []byte) error {\n\tif string(data) == "null" {\n\t\t*u = ${type.name}{}\n\t\treturn nil\n\t}\n\ttag, err := ldrpc.UnionTag(data, ${discriminator})\n\tif err != nil {\n\t\treturn err\n\t}\n\tswitch tag {\n${decodeCases}\n\tdefault:\n\t\treturn fmt.Errorf("${this.ir.service.go.package}: unknown ${type.name} ${type.discriminator} %q", tag)\n\t}\n\treturn nil\n}`
    ];
  }

  inputSchemas() {
    let reachable = new Set<string>();

    let visit = (type: IRType) => {
      switch (type.kind) {
        case 'ref': {
          if (reachable.has(type.name)) return;
          reachable.add(type.name);

          let named = this.named(type.name);
          if (named.kind == 'object') named.fields.forEach(field => visit(field.type));
          if (named.kind == 'alias') visit(named.type);
          if (named.kind == 'union') {
            named.variants.forEach(variant => visit({ kind: 'ref', name: variant.type }));
          }
          return;
        }
        case 'nullable':
          return visit(type.type);
        case 'array':
          return visit(type.items);
        case 'record':
          return visit(type.values);
      }
    };

    this.ir.methods.forEach(method => visit(method.input));

    let strip = (named: IRNamedType) => {
      let { name: _name, description: _description, deprecated: _deprecated, ...body } = named;
      if (body.kind != 'object') return body;
      return {
        ...body,
        fields: body.fields.map(({ description: _d, deprecated: _dep, ...field }) => field)
      };
    };

    return Object.keys(this.ir.types)
      .filter(name => reachable.has(name))
      .map(name => [name, strip(this.named(name))] as const);
  }

  schemasVar() {
    let schemas = this.inputSchemas();
    if (!schemas.length) return undefined;

    let body = `{\n${schemas.map(([name, schema]) => `  ${JSON.stringify(name)}: ${JSON.stringify(schema)}`).join(',\n')}\n}`;
    let literal = body.includes('`') ? JSON.stringify(body) : `\`${body}\``;
    return `var schemas = ldrpc.MustParseSchemas(${literal})`;
  }

  errorCode(error: IRError) {
    return `Code${goName(error.code)}`;
  }

  errors() {
    let errors = Object.values(this.ir.errors);
    if (!errors.length) return [];

    let codes = errors.map(error => {
      let name = this.errorCode(error);
      this.claim(name, `the ${error.code} error code`);
      return [name, `= ${goString(error.code)}`];
    });

    let constructors = errors.map(error => {
      let name = `Err${goName(error.code)}`;
      this.claim(name, `the ${error.code} error constructor`);

      let params = error.data.map(field => ({
        field,
        name: goParamName(field.name),
        type: this.fieldType(field),
        optional: !!field.optional && !this.isNilable(field.type)
      }));

      let base = `ldrpc.NewError(${error.status}, ${this.errorCode(error)}, ${goString(error.message)})`;
      let setter = (field: IRField, value: string) =>
        standardErrorSetters[field.name]
          ? `${standardErrorSetters[field.name]}(${value})`
          : `With(${goString(field.name)}, ${value})`;

      let required = params.filter(param => !param.optional);
      let optional = params.filter(param => param.optional);
      let chain = [base, ...required.map(param => setter(param.field, param.name))].join('.');

      let body = optional.length
        ? [
            `\terr := ${chain}`,
            ...optional.map(
              param =>
                `\tif ${param.name} != nil {\n\t\terr = err.${setter(param.field, `*${param.name}`)}\n\t}`
            ),
            '\treturn err'
          ].join('\n')
        : `\treturn ${chain}`;

      let doc = docLines(error.description ?? error.message);
      return `${doc.join('\n')}\nfunc ${name}(${params.map(param => `${param.name} ${param.type}`).join(', ')}) *ldrpc.Error {\n${body}\n}`;
    });

    return [`const (\n${align(codes, '\t').join('\n')}\n)`, ...constructors];
  }

  ioType(type: IRType) {
    return type.kind == 'void' ? 'ldrpc.Void' : this.type(type);
  }

  methodName(method: IRMethod) {
    return method.path.map(segment => goName(segment)).join('');
  }

  service() {
    let lines = this.ir.methods.flatMap(method => [
      ...docLines(method.description, method.deprecated),
      `${this.methodName(method)}(ctx context.Context, in *${this.ioType(method.input)}) (*${this.ioType(method.output)}, error)`
    ]);

    let doc = docLines(this.ir.service.description);
    return `${doc.length ? `${doc.join('\n')}\n` : ''}type Service interface {\n${lines.map(line => `\t${line}`).join('\n')}\n}`;
  }

  register() {
    let lines = this.ir.methods.map(method => {
      let schema =
        method.input.kind == 'ref'
          ? `, ldrpc.WithInputSchema(schemas.Type(${goString(method.input.name)}))`
          : '';
      return `\tsrv.Handle(${goString(method.name)}, ldrpc.Unary(impl.${this.methodName(method)}${schema}))`;
    });

    return `func Register(srv *ldrpc.Server, impl Service) {\n${lines.join('\n')}\n}`;
  }

  client() {
    let methods = this.ir.methods.map(method => {
      let name = this.methodName(method);
      let output = this.ioType(method.output);
      let opts =
        method.idempotent === false
          ? 'append([]ldrpc.CallOption{ldrpc.WithoutRetry()}, opts...)...'
          : 'opts...';
      let doc = docLines(method.description, method.deprecated);

      return `${doc.length ? `${doc.join('\n')}\n` : ''}func (c *Client) ${name}(ctx context.Context, in *${this.ioType(method.input)}, opts ...ldrpc.CallOption) (*${output}, error) {\n\treturn ldrpc.Call[${output}](ctx, c.rpc, ${goString(method.name)}, in, ${opts})\n}`;
    });

    return [
      'type Client struct {\n\trpc *ldrpc.Client\n}',
      'func NewClient(endpoint string, opts ldrpc.ClientOptions) (*Client, error) {\n\trpc, err := ldrpc.NewClient(endpoint, opts)\n\tif err != nil {\n\t\treturn nil, err\n\t}\n\treturn &Client{rpc: rpc}, nil\n}',
      'func WrapClient(rpc *ldrpc.Client) *Client {\n\treturn &Client{rpc: rpc}\n}',
      ...methods
    ];
  }

  generate() {
    let pkg = this.ir.service.go.package;

    let types = Object.values(this.ir.types).map(type => this.namedType(type));
    let errors = this.errors();
    let schemas = this.schemasVar();
    let service = this.service();
    let register = this.register();
    let client = this.client();

    let std = [...this.imports].sort();
    let imports = `import (\n${std.map(name => `\t${goString(name)}`).join('\n')}\n\n\t${goString(this.opts.ldrpcImport ?? defaultLdrpcImport)}\n)`;

    let packageDoc = docLines(
      [
        `Package ${pkg} is the server interface and client of the ${this.ir.service.name} RPC service.`,
        ...(this.ir.service.description ? ['', this.ir.service.description] : [])
      ].join('\n')
    );
    let sections = [
      `// Code generated by @lowerdeck/rpc-spec from the ${this.ir.service.name} spec. DO NOT EDIT.`,
      `${packageDoc.join('\n')}\npackage ${pkg}`,
      imports,
      ...types,
      ...errors,
      ...(schemas ? [schemas] : []),
      service,
      register,
      ...client
    ];

    return `${sections.join('\n\n')}\n`;
  }
}

export let generateGo = (ir: IR, opts: GoGeneratorOptions = {}) =>
  new GoGenerator(ir, opts).generate();

export let goFileName = (ir: IR) => `${ir.service.go.package}.gen.go`;
