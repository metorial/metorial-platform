import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { atomicWrite, readJson, sortedEntries } from './files';
import { discover, loadExternals, selectWithDependencies } from './manifest';
import { configureManifests, metadata, metadataIfPresent } from './workspace';
import type { Database, Environment, EnvValue, LoadedManifest, ProjectRoot } from './types';

export let isolated = 'CONTROL_ENV_ISOLATED';

export let defaultPorts = {
  postgres: 35432,
  mongo: 32707,
  redis: 36379,
  nats: 34222,
  etcd_client: 32379,
  etcd_peer: 32380
};

export let portKey = (name: string) => `CONTROL_PORT_${name.toUpperCase()}`;

export let flattenJson = (
  object: unknown,
  prefix = '',
  output: Environment = Object.create(null)
): Environment => {
  if (!object || typeof object !== 'object' || Array.isArray(object))
    throw new Error('env.json must contain a JSON object');

  for (let [key, value] of sortedEntries(object as Record<string, unknown>)) {
    let name = prefix ? `${prefix}_${key}` : key;
    if (value === null) continue;

    if (Array.isArray(value))
      throw new Error(`env.json value ${JSON.stringify(name)} must be scalar or an object`);

    if (typeof value === 'object') flattenJson(value, name, output);
    else output[name] = String(value);
  }

  return output;
};

export let rootEnvironment = (project: ProjectRoot): Environment => {
  let path = join(project.root, 'env.json');
  let output = existsSync(path) ? flattenJson(readJson(path)) : {};
  Object.assign(output, {
    METORIAL_ENV: process.env.METORIAL_ENV ?? 'development',
    METORIAL_SOURCE: project.kind,
    IS_ENTERPRISE: String(project.kind === 'enterprise'),
    METORIAL_HOSTNAME:
      process.env.METORIAL_HOSTNAME ?? output.METORIAL_HOSTNAME ?? 'localhost',
    NODE_ENV: process.env.NODE_ENV ?? 'development'
  });

  for (let [key, value] of sortedEntries(defaultPorts)) output[portKey(key)] ??= String(value);

  let data = metadataIfPresent(project.root);
  if (!data) output.CONTROL_LOCAL_SERVICES = '1';
  if (data) {
    output.METORIAL_HOSTNAME = data.hostname;

    if (data.runtime === 'host') {
      if (!data.service_ports)
        throw new Error('host workspace metadata is missing service_ports');

      for (let [key, value] of Object.entries(data.service_ports))
        output[portKey(key)] = String(value);
    }
  }

  return output;
};

export let lookup = (key: string, root: Environment) =>
  Object.hasOwn(root, key)
    ? root[key]
    : Object.hasOwn(root, isolated)
      ? undefined
      : process.env[key];

export let interpolate = (value: string, root: Environment): string => {
  let output = value.replace(/\{\{(.*?)\}\}/g, (_, template: string) => {
    let key = template === 'HOSTNAME' ? 'METORIAL_HOSTNAME' : template;
    if (
      key !== 'METORIAL_HOSTNAME' &&
      !Object.keys(defaultPorts).some(name => portKey(name) === key)
    )
      throw new Error(
        `unknown environment template ${JSON.stringify(template)} in ${JSON.stringify(value)}`
      );

    let resolved = lookup(key, root);
    if (resolved === undefined)
      throw new Error(`environment template ${template} is unresolved`);

    return resolved;
  });
  if (output.includes('{{'))
    throw new Error(`unresolved environment template in ${JSON.stringify(value)}`);

  return output;
};

export let resolveEnvironment = (
  values: Record<string, EnvValue>,
  root: Environment
): Environment => {
  let output: Environment = Object.create(null);

  for (let [key, value] of sortedEntries(values)) {
    let resolved: string | undefined;
    if (typeof value === 'string') resolved = value;
    else if (value === true) resolved = lookup(key, root);
    else if (value === false)
      throw new Error('environment booleans may only be true (lookup)');
    else {
      resolved = value.value ?? lookup(value.from ?? key, root) ?? value.default;

      if (resolved === undefined && value.required)
        throw new Error(`required environment variable ${value.from ?? key} is missing`);
    }

    if (resolved !== undefined) output[key] = interpolate(resolved, root);
  }

  return output;
};

export let interpolateStructured = (value: string, templates: Environment): string => {
  let output = value;

  for (let [key, resolved] of sortedEntries(templates))
    output = output.replaceAll(`{{${key}}}`, () => resolved);

  if (output.includes('{{') || output.includes('}}'))
    throw new Error(`unresolved structured environment template in ${JSON.stringify(value)}`);

  return output;
};

export let allForManifest = (loaded: LoadedManifest, root: Environment): Environment => {
  let manifest = loaded.manifest;
  let output = resolveEnvironment(manifest.env, root);

  for (let key of [
    'METORIAL_ENV',
    'METORIAL_SOURCE',
    'IS_ENTERPRISE',
    'METORIAL_HOSTNAME',
    'NODE_ENV'
  ]) {
    if (root[key] !== undefined) output[key] = root[key];
  }

  for (let [key, db] of sortedEntries(manifest.postgres)) output[key] = postgresUrl(db);

  for (let [key, db] of sortedEntries(manifest.mongo)) output[key] = mongoUrl(db);

  for (let [, endpoint] of sortedEntries(manifest.endpoints)) {
    for (let env of endpoint.env)
      output[env.key] = interpolateStructured(env.value, {
        HOSTNAME: root.METORIAL_HOSTNAME ?? 'localhost',
        PORT: String(endpoint.port),
        BIND_PORT: String(endpoint.bind_port ?? endpoint.port)
      });
  }

  for (let dependency of manifest.dependencies) {
    for (let env of dependency.env) {
      let endpoint = manifest.dependency_endpoints[dependency.identifier]?.[env.endpoint];
      if (!endpoint)
        throw new Error(
          `${loaded.path}: unresolved endpoint ${JSON.stringify(env.endpoint)} on dependency ${JSON.stringify(dependency.identifier)}`
        );
      output[env.key] = interpolateStructured(env.value, {
        HOSTNAME: endpoint.hostname,
        PORT: String(endpoint.port)
      });
    }
  }

  for (let resource of manifest.resources) {
    let name = resource.type === 'etcd' ? 'etcd_client' : resource.type;
    let key = `CONTROL_SERVICE_${resource.type.toUpperCase()}`;
    let service = lookup(key, root);
    let hostname = 'localhost';

    let port = root[portKey(name)] ?? String(defaultPorts[name as keyof typeof defaultPorts]);
    if (service !== undefined) {
      let separator = service.lastIndexOf(':');
      if (separator < 0)
        throw new Error(
          `invalid ${key} address ${JSON.stringify(service)}; expected hostname:port`
        );
      hostname = service.slice(0, separator);
      port = service.slice(separator + 1);
    }

    if (!/^\d+$/.test(port) || Number(port) > 65535) throw new Error(`invalid ${key} port`);

    let templates: Environment = { HOSTNAME: hostname, PORT: port };

    for (let name of ['redis', 'nats', 'etcd_client', 'etcd_peer'])
      if (root[portKey(name)] !== undefined) templates[portKey(name)] = root[portKey(name)]!;
    templates[portKey(name)] = port;

    if (resource.type === 'etcd' && service !== undefined)
      templates.CONTROL_PORT_ETCD_PEER = '2380';

    for (let env of resource.env)
      output[env.key] = interpolateStructured(env.value, templates);
  }

  if (root.CONTROL_LOCAL_SERVICES)
    for (let [key, value] of Object.entries(output))
      if (typeof value == 'string' && value.includes('//services:'))
        output[key] = value
          .replaceAll('//services:52010', '//localhost:35010')
          .replaceAll('//services:', '//localhost:');

  return output;
};

export let hasValues = ({ manifest }: LoadedManifest) =>
  !!(
    Object.keys(manifest.env).length ||
    Object.keys(manifest.postgres).length ||
    Object.keys(manifest.mongo).length ||
    Object.keys(manifest.endpoints).length ||
    manifest.dependencies.some(dependency => dependency.env.length) ||
    manifest.resources.length
  );

export let formatDotenvValue = (value: string): string => {
  if (value !== '' && !/[ \t\n\r#="'`$]/.test(value)) return value;

  if (!/['\n\r]/.test(value)) return `'${value}'`;

  return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\r', '\\r').replaceAll('\n', '\\n')}"`;
};

export let writeDotenv = (path: string, values: Environment) =>
  atomicWrite(
    path,
    sortedEntries(values)
      .map(([key, value]) => `${key}=${formatDotenvValue(value)}`)
      .join('\n') + '\n'
  );

export let writeForManifest = (loaded: LoadedManifest, root: Environment) => {
  let path = join(dirname(loaded.path), '.env');
  writeDotenv(path, allForManifest(loaded, root));

  return path;
};

export let writeForProject = async (
  project: ProjectRoot,
  selectors: string[]
): Promise<string[]> => {
  await metadata(project);

  let manifests = discover(project.root);
  await configureManifests(project, manifests);

  let externals = loadExternals(project.root, manifests);
  let selected = selectWithDependencies(manifests, selectors, project.kind, externals);
  let root = rootEnvironment(project);

  return selected.filter(hasValues).map(loaded => writeForManifest(loaded, root));
};

export let encode = (value: string) =>
  encodeURIComponent(value).replace(
    /[!'()*]/g,
    character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );

export let postgresUrl = (db: Database) =>
  `postgresql://${encode(db.user!)}:${encode(db.password!)}@${db.host}:${db.port}/${encode(db.database)}`;

export let mongoUrl = (db: Database) => {
  let auth =
    db.user !== undefined
      ? `${encode(db.user)}${db.password !== undefined ? ':' + encode(db.password) : ''}@`
      : '';
  let query = db.auth_source !== undefined ? `?authSource=${encode(db.auth_source)}` : '';

  return `mongodb://${auth}${db.host}:${db.port}/${encode(db.database)}${query}`;
};
