import z from 'zod';

export let configs = new Set<McpServerConfig<any>>();

export class McpServerConfig<Config extends {}> {
  #value: Config | null = null;
  #isRegistered = false;

  private constructor(public readonly schema: z.ZodType<Config>) {
    configs.add(this);
  }

  static create<Config extends {}>(schema: z.ZodType<Config>) {
    return new McpServerConfig(schema);
  }

  static assertRegistered(config: McpServerConfig<any>) {
    if (!config.#isRegistered) {
      throw new Error(
        'MCP Server config is not registered with `createMcpServer`. Please pass your config as `config` when creating the server.'
      );
    }
  }

  setValue(value: unknown) {
    let parsed = this.schema.parse(value);
    this.#value = parsed;
  }

  registered() {
    this.#isRegistered = true;
  }

  value(): Config {
    let self = this;

    // Proxy for getting the config values
    // or throwing an error if not set
    return new Proxy(
      {},
      {
        get: (target, prop, receiver) => {
          if (prop == '__config__') {
            return self;
          }

          if (self.#value === null || !self.#isRegistered) {
            throw new Error(
              'MCP Server config is not registered with `createMcpServer`. Please pass your config as `config` when creating the server.'
            );
          }

          return (self.#value as any)[prop];
        }
      }
    ) as any as Config;
  }
}

export let createConfig = <Config extends {}>(schema: z.ZodType<Config>) => {
  return McpServerConfig.create(schema).value();
};

export let config = <Config extends {}>(schema: z.ZodType<Config>) => createConfig(schema);

export let setConfigValue = <Config extends {}>(configValue: any, value: Config) => {
  let self = configValue['__config__'] as McpServerConfig<Config>;
  self.setValue(value);
  self.registered();
};

export let registerConfig = <Config extends {}>(configValue: any) => {
  let self = configValue['__config__'] as McpServerConfig<Config>;
  self.registered();
};

export let getConfigSchema = <Config extends {}>(configValue: any) => {
  let self = configValue['__config__'] as McpServerConfig<Config>;
  return self.schema.toJSONSchema({
    unrepresentable: 'any',
    override: ctx => {
      let def = ctx.zodSchema._zod.def;

      if (def.type === 'date') {
        ctx.jsonSchema.type = 'string';
        ctx.jsonSchema.format = 'date-time';
      }
      if (def.type === 'bigint') {
        ctx.jsonSchema.type = 'number';
      }
    }
  });
};
