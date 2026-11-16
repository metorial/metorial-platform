import { createHmac, timingSafeEqual } from 'crypto';

let SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

let signaturesEqual = (provided: string, expected: string) => {
  let providedBuffer = Buffer.from(provided, 'hex');
  let expectedBuffer = Buffer.from(expected, 'hex');
  return (
    providedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(providedBuffer, expectedBuffer)
  );
};

export let verifyAresSignature = (input: {
  signatureHeader: string | undefined;
  secret: string;
  body: string;
}) => {
  if (!input.signatureHeader) return false;

  let parts = input.signatureHeader.split(',').map(part => part.trim());
  let timestamp = parts.find(part => part.startsWith('t='))?.slice(2);
  let signatures = parts
    .filter(part => part.startsWith('v1='))
    .map(part => part.slice(3))
    .filter(signature => /^[a-f0-9]{64}$/i.test(signature));
  if (!timestamp || !/^\d+$/.test(timestamp) || signatures.length === 0) return false;

  let timestampSeconds = Number(timestamp);
  if (!Number.isSafeInteger(timestampSeconds)) return false;
  if (
    Math.abs(Math.floor(Date.now() / 1000) - timestampSeconds) > SIGNATURE_TOLERANCE_SECONDS
  ) {
    return false;
  }

  let expected = createHmac('sha256', input.secret)
    .update(`${timestamp}.${input.body}`)
    .digest('hex');
  return signatures.some(signature => signaturesEqual(signature, expected));
};

export let parseAresSyncEvent = <TEvent>(input: {
  body: string;
  isValid: (event: any) => event is TEvent;
}): TEvent | null => {
  let event: unknown;
  try {
    event = JSON.parse(input.body);
  } catch {
    return null;
  }

  return input.isValid(event) ? event : null;
};
