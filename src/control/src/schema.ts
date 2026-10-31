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
  type: v.enumOf(['redis', 'nats', 'etcd']),
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

export let manifestSchema = strictObject({
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
        protocol: v.optional(v.enumOf(['http', 'h2c']))
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
            stagingOnly: v.optional(v.boolean())
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
      etcd_peer: port
    })
  ),
  endpoint_ports: v.optional(v.record(v.record(port)))
});
