import { base62 } from '@metorial/base62';
import { base86 } from './base86';

let enc = new TextEncoder();
let dec = new TextDecoder();

let getPasswordKey = (password: string) =>
  crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);

let deriveKey = (passwordKey: CryptoKey, keyUsage: ('encrypt' | 'decrypt')[]) =>
  crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      iterations: 250000,
      hash: 'SHA-256'
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    keyUsage
  );

let encryptData = async (secretData: string, password: string) => {
  let iv = crypto.getRandomValues(new Uint8Array(12));
  let passwordKey = await getPasswordKey(password);
  let aesKey = await deriveKey(passwordKey, ['encrypt']);
  let encryptedContent = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv
    },
    aesKey,
    enc.encode(secretData)
  );

  let encryptedContentArr = new Uint8Array(encryptedContent);
  let buff = new Uint8Array(iv.byteLength + encryptedContentArr.byteLength);
  buff.set(iv, 0);
  buff.set(encryptedContentArr, iv.byteLength);

  return base86.encode(buff);
};

let decryptData = async (encryptedData: string, password: string) => {
  let encryptedDataBuff = base86.decode(encryptedData);
  let iv = encryptedDataBuff.slice(0, 16);
  let data = encryptedDataBuff.slice(16);
  let passwordKey = await getPasswordKey(password);
  let aesKey = await deriveKey(passwordKey, ['decrypt']);
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
