import { ensureSecretStore, Secret, SecretStore } from '@metorial/db';

export class SecretStoreManager {
  private store: Promise<SecretStore>;

  private constructor(
    public readonly slug: string,
    public readonly name: string,
    private readonly encrypt: (secret: Secret, data: string) => Promise<string>,
    private readonly decrypt: (secret: Secret, data: string) => Promise<string>
  ) {
    this.store = ensureSecretStore(() => ({
      slug: this.slug,
      name: this.name
    }));
  }

  static create(d: {
    name: string;
    slug: string;
    encrypt: (secret: Secret, data: string) => Promise<string>;
    decrypt: (secret: Secret, data: string) => Promise<string>;
  }): SecretStoreManager {
    return new SecretStoreManager(d.slug, d.name, d.encrypt, d.decrypt);
  }

  async get() {
    return await this.store;
  }

  async encryptSecret(secret: Secret, data: string) {
    await this.get();
    return await this.encrypt(secret, data);
  }

  async decryptSecret(secret: Secret, data: string) {
    await this.get();
    return await this.decrypt(secret, data);
  }
}
