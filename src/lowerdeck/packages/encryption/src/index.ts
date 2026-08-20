import { generatePlainId } from '@lowerdeck/id';
import { secretsCrypto } from './crypto';

export class Encryption {
  constructor(private readonly password: string) {}

  private async getPassword(entityId: string) {
    return (await secretsCrypto.sha512(`${entityId}${this.password!}`)).slice(0, 50);
  }

  async encrypt(input: { secret: string; entityId: string }) {
    return await secretsCrypto.encrypt(
      JSON.stringify({
        id: generatePlainId(10),
        key: input.secret
      }),
      await this.getPassword(input.entityId)
    );
  }

  async decrypt(info: { encrypted: string; entityId: string }) {
    let content = JSON.parse(
      await secretsCrypto.decrypt(info.encrypted, await this.getPassword(info.entityId))
    );

    return content.key;
  }
}

export class VersionedEncryptionKeyring {
  private readonly encryptions = new Map<number, Encryption>();
  private readonly aadVersions: ReadonlySet<number>;

  constructor(d: {
    keys: Readonly<Record<number, string>>;
    activeKeyVersion: number;
    supportedAadVersions: readonly number[];
  }) {
    for (let [version, key] of Object.entries(d.keys)) {
      let parsed = Number(version);
      if (!Number.isInteger(parsed) || parsed <= 0 || !key) {
        throw new Error('Encryption keyring versions must be positive integers');
      }
      this.encryptions.set(parsed, new Encryption(key));
    }
    if (!this.encryptions.has(d.activeKeyVersion)) {
      throw new Error('Encryption keyring active version is not configured');
    }
    this.activeKeyVersion = d.activeKeyVersion;
    this.aadVersions = new Set(d.supportedAadVersions);
    if (this.aadVersions.size !== d.supportedAadVersions.length) {
      throw new Error('Encryption keyring AAD versions must be unique');
    }
    for (let version of this.aadVersions) {
      if (!Number.isInteger(version) || version <= 0) {
        throw new Error('Encryption keyring AAD versions must be positive integers');
      }
    }
  }

  readonly activeKeyVersion: number;

  assertAadVersion(version: number) {
    if (!this.aadVersions.has(version)) {
      throw new Error(`Unsupported encrypted secret AAD version: ${version}`);
    }
  }

  async encrypt(d: {
    secret: string;
    entityId: string;
    encryptionKeyVersion?: number;
    aadVersion: number;
  }) {
    this.assertAadVersion(d.aadVersion);
    let version = d.encryptionKeyVersion ?? this.activeKeyVersion;
    let encryption = this.encryptions.get(version);
    if (!encryption) throw new Error(`Unknown encryption key version: ${version}`);
    return await encryption.encrypt({ secret: d.secret, entityId: d.entityId });
  }

  async decrypt(d: {
    encrypted: string;
    entityId: string;
    encryptionKeyVersion: number;
    aadVersion: number;
  }) {
    this.assertAadVersion(d.aadVersion);
    let encryption = this.encryptions.get(d.encryptionKeyVersion);
    if (!encryption) {
      throw new Error(`Unknown encryption key version: ${d.encryptionKeyVersion}`);
    }
    return await encryption.decrypt({ encrypted: d.encrypted, entityId: d.entityId });
  }
}

export let parseSupportedEncryptionAadVersions = (d: {
  configured?: string;
  activeAadVersion: number;
  defaultHistoricalVersions?: readonly number[];
}) => {
  let configured = d.configured?.trim();
  let parsed: unknown = configured
    ? configured.startsWith('[')
      ? JSON.parse(configured)
      : configured.split(',').map(value => Number(value.trim()))
    : [...new Set([...(d.defaultHistoricalVersions ?? [1]), d.activeAadVersion])];
  if (!Array.isArray(parsed)) {
    throw new Error('Supported encrypted secret AAD versions must be an array');
  }
  let versions = parsed.map(value => Number(value));
  if (
    versions.length === 0 ||
    new Set(versions).size !== versions.length ||
    versions.some(version => !Number.isInteger(version) || version <= 0)
  ) {
    throw new Error(
      'Supported encrypted secret AAD versions must be unique positive integers'
    );
  }
  if (!versions.includes(d.activeAadVersion)) {
    throw new Error('Active encrypted secret AAD version is not supported');
  }
  return versions;
};
