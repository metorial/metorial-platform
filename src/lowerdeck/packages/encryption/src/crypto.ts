import { base62 } from '@lowerdeck/base62';
import { base86 } from './base86';

let enc = new TextEncoder();
let dec = new TextDecoder();

let getPasswordKey = (password: string) =>
  crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);

let deriveKey = (passwordKey: CryptoKey, salt: BufferSource, keyUsage: ('encrypt' | 'decrypt')[]) =>
  crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 250000,
      hash: 'SHA-256'
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    keyUsage
  );

let encryptData = async (secretData: string, password: string) => {
  let salt = crypto.getRandomValues(new Uint8Array(16));
  let iv = crypto.getRandomValues(new Uint8Array(12));
  let passwordKey = await getPasswordKey(password);
  let aesKey = await deriveKey(passwordKey, salt, ['encrypt']);
  let encryptedContent = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv
    },
    aesKey,
    enc.encode(secretData)
  );

  let encryptedContentArr = new Uint8Array(encryptedContent);
  let buff = new Uint8Array(salt.byteLength + iv.byteLength + encryptedContentArr.byteLength);
  buff.set(salt, 0);
  buff.set(iv, salt.byteLength);
  buff.set(encryptedContentArr, salt.byteLength + iv.byteLength);

  return base86.encode(buff);
};

let decryptData = async (encryptedData: string, password: string) => {
  let encryptedDataBuff = base86.decode(encryptedData);
  let salt = encryptedDataBuff.slice(0, 16);
  let iv = encryptedDataBuff.slice(16, 28);
  let data = encryptedDataBuff.slice(28);
  let passwordKey = await getPasswordKey(password);
  let aesKey = await deriveKey(passwordKey, salt, ['decrypt']);
  let decryptedContent = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv
    },
    aesKey,
    data
  );

  return dec.decode(decryptedContent);
};

let sha512 = async (data: string) => {
  let hashBuffer = await crypto.subtle.digest('SHA-512', enc.encode(data));
  return base62.encode(new Uint8Array(hashBuffer));
};

export let secretsCrypto = {
  encrypt: encryptData,
  decrypt: decryptData,
  sha512
};
