import { generatePlainId } from '@metorial/id';
import { decodeBase62, encodeBase62 } from './base62';

export type ApiKeyVersions = 'v2';

export type ApiKeyType =
  | 'user_auth_token'
  | 'organization_management_token'
  | 'organization_app_access_token'
  | 'instance_access_token_secret'
  | 'instance_access_token_publishable'
  | 'fine_grained_token'
  | 'ephemeral_client_secret'
  | 'magic_mcp_token_secret';

let keyTypes = {
  uk: 'user_auth_token',
  lk: 'organization_management_token',
  ak: 'organization_app_access_token',
  sk: 'instance_access_token_secret',
  pk: 'instance_access_token_publishable',
  fk: 'fine_grained_token',
  ek: 'ephemeral_client_secret',
  mk: 'magic_mcp_token_secret'
} as const;

let keyTypesReverse = Object.fromEntries(
  Object.entries(keyTypes).map(([key, value]) => [value, key])
) as Record<ApiKeyType, keyof typeof keyTypes>;

export type ApiKeyPrefix = `metorial_${keyof typeof keyTypes}_`;
export type ApiKey = `${ApiKeyPrefix}${string}`;

const METORIAL_PREFIX = 'metorial';

const SECRET_KEY_LENGTH = 60;

const INSTANCES = ['v2-us1', 'v2-eu1'] as const;
type ApiKeyConfig = {
  url: string;
  instance: (typeof INSTANCES)[number];
};

let parseApiKey = (key: string) => {
  let parts = key.split('_');
  if (parts[0] != METORIAL_PREFIX) return null;

  let type = keyTypes[parts[1] as keyof typeof keyTypes];
  if (!type) return null;

  let rest = parts.slice(2).join('_');

  let version = rest.slice(-2);
  if (version != 'v2') return null;

  let secret = rest.slice(0, SECRET_KEY_LENGTH);
  if (secret.length != SECRET_KEY_LENGTH) return null;

  let configStr = rest.slice(SECRET_KEY_LENGTH, -2);
  let config: ApiKeyConfig | undefined = undefined;

  try {
    let configDecoded = JSON.parse(decodeBase62(configStr));
    if (
      !Array.isArray(configDecoded) ||
      configDecoded.length != 2 ||
      typeof configDecoded[0] != 'string' ||
      !INSTANCES.includes(configDecoded[1])
    ) {
      return null;
    }

    config = {
      url: configDecoded[0],
      instance: configDecoded[1] as ApiKeyConfig['instance']
    };
  } catch (e) {
    return null;
  }

  return {
    type,
    secret,
    config,
    version: version as ApiKeyVersions
  };
};

export class UnifiedApiKey {
  private constructor(
    public readonly type: ApiKeyType,
    private readonly secret: string,
    public readonly config: ApiKeyConfig,
    public readonly version: ApiKeyVersions
  ) {}

  static from(key: string) {
    let parsed = parseApiKey(key);
    if (!parsed) return null;

    return new UnifiedApiKey(parsed.type, parsed.secret, parsed.config, parsed.version);
  }

  static create(d: { type: ApiKeyType; config: ApiKeyConfig; secret?: string }) {
    if (d.secret && d.secret.length != SECRET_KEY_LENGTH) {
      throw new Error(`Secret key must be ${SECRET_KEY_LENGTH} characters long`);
    }

    let secret = d.secret ? d.secret : generatePlainId(SECRET_KEY_LENGTH);

    return new UnifiedApiKey(d.type, secret, d.config, 'v2');
  }

  static redact(key: string | UnifiedApiKey) {
    let parts = key.toString().split('_');
    if (parts[0] != METORIAL_PREFIX) return key.toString();

    let [metorial, type, ...rest] = parts;
    let secret = rest.join('_');

    return `${metorial}_${type}_${secret.slice(0, 4)}...${secret.slice(-4)}`;
  }

  toString() {
    let config = encodeBase62(JSON.stringify([this.config.url, this.config.instance]));

    return `${METORIAL_PREFIX}_${keyTypesReverse[this.type]}_${this.secret}${config}v2`;
  }
}
