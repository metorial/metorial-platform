export class SecureEncryption {
  private password: string;

  constructor(password: string) {
    this.password = password;
  }

  private async deriveKey(salt: Uint8Array): Promise<CryptoKey> {
    let encoder = new TextEncoder();
    let keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(this.password),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    return await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  }

  public async encrypt(plainText: string): Promise<string> {
    let encoder = new TextEncoder();
    let data = encoder.encode(plainText);
    let iv = crypto.getRandomValues(new Uint8Array(12));
    let salt = crypto.getRandomValues(new Uint8Array(16)); // Generate a random salt
    let key = await this.deriveKey(salt);

    let encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, data);
    let combinedData = new Uint8Array([...salt, ...iv, ...new Uint8Array(encrypted)]);

    return btoa(String.fromCharCode(...combinedData));
  }

  public async decrypt(encryptedString: string): Promise<string> {
    let combinedData = new Uint8Array(
      atob(encryptedString)
        .split('')
        .map(c => c.charCodeAt(0))
    );

    let salt = combinedData.slice(0, 16);
    let iv = combinedData.slice(16, 28);
    let encryptedData = combinedData.slice(28);

    let key = await this.deriveKey(salt);
    let decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encryptedData
    );

    return new TextDecoder().decode(decrypted);
  }
}
