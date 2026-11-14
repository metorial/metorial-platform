interface SignatureOptions {
  timestamp?: number;
  scheme?: 'v1';
}

let hexToBytes = (hex: string): Uint8Array => {
  let bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
};

let bufferToHex = (buffer: ArrayBuffer): string => {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

export let generateSignature = async (
  body: string | object,
  signingSecret: string,
  options: SignatureOptions = {}
): Promise<string> => {
  let payload = typeof body === 'string' ? body : JSON.stringify(body);
  let timestamp = options.timestamp || Math.floor(Date.now() / 1000);
  let scheme = options.scheme || 'v1';

  let signedPayload = `${timestamp}.${payload}`;

  let encoder = new TextEncoder();
  let keyData = encoder.encode(signingSecret);
  let messageData = encoder.encode(signedPayload);

  let key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  let signatureBuffer = await crypto.subtle.sign('HMAC', key, messageData);
  let signature = bufferToHex(signatureBuffer);

  return `t=${timestamp},${scheme}=${signature}`;
};
