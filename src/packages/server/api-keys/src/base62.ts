const BASE62_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

export let encodeBase62 = (buffer: Buffer | string) => {
  buffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

  let bigint = BigInt('0x' + (buffer.toString('hex') || '0'));
  if (bigint === 0n) return '0';

  let result = '';
  let base = BigInt(62);

  while (bigint > 0n) {
    let remainder = bigint % base;
    result = BASE62_ALPHABET[Number(remainder)] + result;
    bigint = bigint / base;
  }

  return result;
};

export let decodeBase62 = (encoded: string) => {
  let bigint = 0n;
  let base = BigInt(62);

  for (let i = 0; i < encoded.length; i++) {
    let index = BASE62_ALPHABET.indexOf(encoded[i]);
    if (index === -1) throw new Error('Invalid character');
    bigint = bigint * base + BigInt(index);
  }

  let hex = bigint.toString(16);
  if (hex.length % 2) hex = '0' + hex;
  return Buffer.from(hex, 'hex').toString();
};
