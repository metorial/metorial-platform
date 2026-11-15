let toHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');

// `t=<unix seconds>,v1=<hmac sha256 of "<t>.<body>">` — the timestamp is part of the signed payload
// so a captured delivery can't be replayed indefinitely.
export let generateSignature = async (d: {
  body: string;
  signingSecret: string;
  timestamp?: number;
}) => {
  let timestamp = d.timestamp ?? Math.floor(Date.now() / 1000);

  let encoder = new TextEncoder();
  let key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(d.signingSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  let signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`${timestamp}.${d.body}`)
  );

  return { timestamp, signature: `t=${timestamp},v1=${toHex(signature)}` };
};
