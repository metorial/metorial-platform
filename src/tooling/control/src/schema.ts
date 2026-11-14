import { v, type ValidationType, type ValidationTypeValue } from '@lowerdeck/validation';

export let strictObject = <S extends Record<string, ValidationType<unknown>>>(shape: S) => {
  let validator = v.object(shape);
  let original = validator.validate;
  validator.validate = value => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      let unknown = Object.keys(value).filter(key => !Object.hasOwn(shape, key));
      if (unknown.length)
        return v.error([
          { code: 'unknown_field', message: `unknown field ${unknown.join(', ')}` }
        ]);
    }

    return original(value);
  };

  return validator;
};

export let parse = <T>(schema: ValidationType<T>, value: unknown, context: string): T => {
  let result = schema.validate(value);
  if (!result.success) {
    throw new Error(
      `${context}: ${result.errors.map(error => `${error.path?.join('.') ?? ''} ${error.message}`).join('; ')}`
    );
  }

  return result.value;
};

let str = v.string();

let strings = v.array(str);

let optionalString = v.optional(str);

let port = v.number({ modifiers: [v.integer(), v.minValue(0), v.maxValue(65535)] });

let migration = strictObject({
  name: str,
  package: str,
  path: optionalString,
  env: v.union([str, strings]),
  fallback: v.optional(v.union([str, strings])),
  parts: v.optional(v.union([str, strings])),
  query: optionalString,
  precedence: v.optional(v.enumOf(['url', 'parts'])),
  defaults: v.optional(strictObject({ port: optionalString, name: optionalString })),
  encode: v.optional(v.boolean()),
  iam: v.optional(strictObject({ arnEnv: str, regionEnv: optionalString })),
  lock: v.optional(v.number({ modifiers: [v.integer()] })),
  renames: v.optional(v.array(strictObject({ table: str, from: str, to: str })))
});

let buildSpec = strictObject({
  kind: v.literal('bun-service'),
  tasks: v.optional(strings),
  include: v.optional(strings),
  closure: v.optional(v.boolean()),
  concurrency: v.optional(v.number({ modifiers: [v.integer(), v.minValue(1)] })),
  heapMb: v.optional(v.number({ modifiers: [v.integer(), v.minValue(1)] })),
  start: optionalString,
  ports: v.optional(v.array(port)),
  health: v.optional(v.array(strictObject({ port, path: str }))),
  migrations: v.optional(v.array(migration)),
  assets: v.optional(v.array(strictObject({ from: str, to: optionalString }))),
  packages: v.optional(
    strictObject({ build: v.optional(strings), runtime: v.optional(strings) })
  ),
  modules: v.optional(v.enumOf(['production', 'none'])),
  sentry: v.optional(v.boolean()),
  node: v.optional(v.boolean()),
  env: v.optional(v.record(str)),
  buildEnv: v.optional(v.record(str)),
  sources: v.optional(strings),
  strip: v.optional(strings),
  runtime: v.optional(v.enumOf(['bundle', 'source'])),
  release: v.optional(v.boolean()),
  versioned: v.optional(v.boolean()),
  generateFirst: v.optional(v.boolean())
});

let envSpec = strictObject({
  value: optionalString,
  from: optionalString,
  default: optionalString,
  required: v.optional(v.boolean())
});

let env = v.record(v.union([str, v.boolean(), envSpec]));

let keyValue = strictObject({ key: str, value: str });

let healthSpec = strictObject({ path: str, status: v.optional(port) });

let resource = strictObject({
  type: v.enumOf(['redis', 'nats', 'etcd', 'mail', 'postgres']),
  env: v.optional(v.array(keyValue))
});

let database = (mongo: boolean) =>
  strictObject({
    package: str,
    host: optionalString,
    port: v.optional(port),
    user: optionalString,
    password: optionalString,
    database: str,
    service: optionalString,
    compose: optionalString,
    ...(mongo ? { auth_source: optionalString } : {})
  });

let stackId = v.string();

let stackMember = strictObject({
  mode: v.optional(v.enumOf(['both', 'oss', 'enterprise'])),
  init: v.optional(v.boolean()),
  volumes: v.optional(v.record(str)),
  env: v.optional(env),
  development: v.optional(
    strictObject({
      disabled: v.optional(v.boolean()),
      container: v.optional(v.boolean()),
      run: v.optional(strings),
      env: v.optional(env)
    })
  ),
  production: v.optional(
    strictObject({
      disabled: v.optional(v.boolean()),
      image: optionalString,
      dockerfile: optionalString,
      workspace: optionalString,
      args: v.optional(v.record(str)),
      command: optionalString,
      target: optionalString,
      env: v.optional(env)
    })
  )
});

export let manifestSchema = strictObject({
  stack_definitions: v.optional(
    v.array(
      strictObject({
        id: stackId,
        label: optionalString,
        mode: v.optional(v.enumOf(['both', 'oss', 'enterprise'])),
        description: optionalString,
        edition: v.optional(v.enumOf(['cloud', 'on-prem']))
      })
    )
  ),
  stack_only: v.optional(v.boolean()),
  stacks: v.optional(v.record(stackMember)),
  name: optionalString,
  group: optionalString,
  mode: v.optional(v.enumOf(['both', 'oss', 'enterprise'])),
  dependencies: v.optional(
    v.array(
      v.union([
        str,
        strictObject({
          identifier: str,
          start: v.optional(v.boolean()),
          env: v.optional(v.array(strictObject({ endpoint: str, key: str, value: str })))
        })
      ])
    )
  ),
  endpoints: v.optional(
    v.record(
      strictObject({
        port,
        env: v.optional(v.array(keyValue)),
        health: v.optional(v.union([str, healthSpec])),
        protocol: v.optional(v.enumOf(['http', 'h2c'])),
        link: v.optional(
          strictObject({
            label: str,
            group: v.optional(v.enumOf(['app', 'admin', 'tool'])),
            menu: v.optional(str),
            path: v.optional(str)
          })
        ),
        dev_login: v.optional(strictObject({ path: str }))
      })
    )
  ),
  resources: v.optional(v.array(resource)),
  dev: v.optional(
    strictObject({
      prepare: v.optional(strings),
      run: v.optional(strings),
      cleanup: v.optional(strings),
      env: v.optional(env),
      expose: v.optional(v.array(strictObject({ port }))),
      db: v.optional(
        v.record(
          strictObject({
            name: str,
            engine: v.enumOf(['postgres', 'mongodb', 'mongo']),
            env: str,
            package: str
          })
        )
      )
    })
  ),
  package: v.optional(strictObject({ name: str, groups: v.optional(strings) })),
  groups: v.optional(v.record(strings)),
  env: v.optional(env),
  expose: v.optional(v.array(strictObject({ port }))),
  postgres: v.optional(v.record(database(false))),
  mongo: v.optional(v.record(database(true))),
  run: v.optional(
    v.record(
      strictObject({
        command: str,
        cwd: optionalString,
        env: v.optional(env),
        depends_on: v.optional(strings)
      })
    )
  ),
  prepare: v.optional(strings),
  docker: v.optional(
    strictObject({
      compose: v.optional(strings),
      services: v.optional(strings),
      stop: v.optional(v.boolean())
    })
  ),
  cleanup: v.optional(
    strictObject({ paths: v.optional(strings), commands: v.optional(strings) })
  ),
  health: v.optional(v.array(strictObject({ port, path: str, status: v.optional(port) }))),
  e2e: v.optional(
    strictObject({
      start: v.optional(strings),
      image: optionalString,
      tests: v.optional(strings),
      services: v.optional(strings),
      health_timeout: v.optional(v.number({ modifiers: [v.integer(), v.minValue(0)] })),
      env: v.optional(env),
      resources: v.optional(v.array(strictObject({ type: v.literal('object-storage') })))
    })
  ),
  ci: v.optional(
    strictObject({
      images: v.optional(
        v.array(
          strictObject({
            name: str,
            group: optionalString,
            dockerfile: optionalString,
            workspace: optionalString,
            image: optionalString,
            ecr: optionalString,
            canonical: optionalString,
            source: optionalString,
            platform: optionalString,
            stagingOnly: v.optional(v.boolean()),
            build: v.optional(buildSpec)
          })
        )
      ),
      dockerfiles: v.optional(
        v.array(
          strictObject({
            dockerfile: optionalString,
            workspace: optionalString,
            build: buildSpec
          })
        )
      ),
      suite: v.optional(
        strictObject({
          name: str,
          runner: optionalString,
          groups: v.optional(v.number({ modifiers: [v.integer(), v.minValue(0)] })),
          workspacePackages: v.optional(strings),
          profiles: v.optional(strings)
        })
      )
    })
  )
});

export let externalSchema = strictObject({
  external: v.optional(
    v.array(
      strictObject({ identifier: str, hostname: str, mapping: v.optional(v.record(port)) })
    )
  )
});

export type RawManifest = ValidationTypeValue<typeof manifestSchema>;

export let workspaceMetadataSchema = v.object({
  id: str,
  hostname: str,
  branch: str,
  source_root: str,
  runtime: v.optional(v.enumOf(['host', 'docker'])),
  service_ports: v.optional(
    v.object({
      postgres: port,
      mongo: port,
      redis: port,
      nats: port,
      etcd_client: port,
      etcd_peer: port,
      mail: v.optional(port),
      mail_ui: v.optional(port)
    })
  ),
  endpoint_ports: v.optional(v.record(v.record(port)))
});
