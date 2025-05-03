import { generatePlainId } from '@metorial/id';
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
