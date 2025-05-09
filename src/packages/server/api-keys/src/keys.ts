import { generatePlainId } from '@metorial/id';
import { decodeBase62, encodeBase62 } from './base62';

export type ApiKeyType =
  | 'user_auth_token'
  | 'organization_management_token'
  | 'organization_app_access_token'
  | 'instance_access_token_secret'
  | 'instance_access_token_publishable';

export type ApiKeyVersions = 'v1';

let keyTypes = {
  uk: 'user_auth_token',
  mk: 'organization_management_token',
  ak: 'organization_app_access_token',
  sk: 'instance_access_token_secret',
  pk: 'instance_access_token_publishable'
} as const;

let keyTypesReverse = Object.fromEntries(
  Object.entries(keyTypes).map(([key, value]) => [value, key])
) as Record<ApiKeyType, keyof typeof keyTypes>;

export type ApiKeyPrefix = `metorial_${keyof typeof keyTypes}_`;
export type ApiKey = `${ApiKeyPrefix}${string}`;

const METORIAL_PREFIX = 'metorial';

const SECRET_KEY_LENGTH = 40;

type ApiKeyConfig = {
  url: string;
};

let parseApiKey = (key: string) => {
  let parts = key.split('_');
  if (parts[0] != METORIAL_PREFIX) return null;

  let type = keyTypes[parts[1] as keyof typeof keyTypes];
  if (!type) return null;

  let rest = parts.slice(2).join('_');

  let version = rest.slice(-2);
  if (version != 'v1') return null;

  let secret = rest.slice(0, SECRET_KEY_LENGTH);
  if (secret.length != SECRET_KEY_LENGTH) return null;

  let configStr = rest.slice(SECRET_KEY_LENGTH, -2);
  let config: ApiKeyConfig | undefined = undefined;

  try {
    let configDecoded = JSON.parse(decodeBase62(configStr));
    if (
      !Array.isArray(configDecoded) ||
      configDecoded.length != 1 ||
      typeof configDecoded[0] != 'string'
    ) {
      return null;
    }

    config = {
      url: configDecoded[0]
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

  static create(d: { type: ApiKeyType; config: ApiKeyConfig }) {
    let secret = generatePlainId(SECRET_KEY_LENGTH);

    // if (d.secret.length != SECRET_KEY_LENGTH) {
    //   throw new Error(`Secret key must be ${SECRET_KEY_LENGTH} characters long`);
    // }

    return new UnifiedApiKey(d.type, secret, d.config, 'v1');
  }

  static redact(key: string | UnifiedApiKey) {
    let parts = key.toString().split('_');
    if (parts[0] != METORIAL_PREFIX) return key.toString();

    let [metorial, type, ...rest] = parts;
    let secret = rest.join('_');

    return `${metorial}_${type}_${secret.slice(0, 4)}...${secret.slice(-4)}`;
  }

  toString() {
    let config = encodeBase62(JSON.stringify([this.config.url]));

    return `${METORIAL_PREFIX}_${keyTypesReverse[this.type]}_${this.secret}${config}v1`;
  }
}
