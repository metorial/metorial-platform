import { generatePlainId } from '@lowerdeck/id';
import { secretsCrypto } from './crypto';

export class Encryption {
  constructor(private readonly password: string) {}

  private async getPassword(entityId: string) {
    return (await secretsCrypto.sha512(`${entityId}${this.password!}`)).slice(0, 50);
  }

  private envelope(secret: string) {
    return JSON.stringify({ id: generatePlainId(10), key: secret });
  }

  async encrypt(input: { secret: string; entityId: string }) {
    return await secretsCrypto.encrypt(
      this.envelope(input.secret),
      await this.getPassword(input.entityId)
    );
  }

  async decrypt(info: { encrypted: string; entityId: string }) {
    let content = JSON.parse(
      await secretsCrypto.decrypt(info.encrypted, await this.getPassword(info.entityId))
    );

    return content.key;
  }

  async encryptToBytes(input: { secret: string; entityId: string }): Promise<Uint8Array> {
    return await secretsCrypto.encryptToBytes(
      this.envelope(input.secret),
      await this.getPassword(input.entityId)
    );
  }

  async decryptFromBytes(info: { encrypted: Uint8Array; entityId: string }): Promise<string> {
    let content = JSON.parse(
      await secretsCrypto.decryptFromBytes(
        info.encrypted,
        await this.getPassword(info.entityId)
      )
    );

    return content.key;
  }
}
