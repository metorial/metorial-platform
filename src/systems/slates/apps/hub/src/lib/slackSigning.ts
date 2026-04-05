import { createHmac, timingSafeEqual } from 'crypto';

let maxSkewSeconds = 60 * 5;

export let verifySlackRequestSignature = (d: {
  signingSecret: string;
  rawBody: string;
  requestTimestamp: string | undefined;
  slackSignature: string | undefined;
}): boolean => {
  if (!d.slackSignature || !d.requestTimestamp) return false;

  let ts = Number(d.requestTimestamp);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(Date.now() / 1000 - ts) > maxSkewSeconds) return false;

  let base = `v0:${d.requestTimestamp}:${d.rawBody}`;
  let digest = createHmac('sha256', d.signingSecret).update(base).digest('hex');
  let expected = `v0=${digest}`;

  let a = Buffer.from(expected, 'utf8');
  let b = Buffer.from(d.slackSignature, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
};

export let resolveSlackSigningSecret = (d: {
  secretsJson: string | undefined;
  singleSecret: string | undefined;
  apiAppId: string | undefined;
}): string | null => {
  if (d.secretsJson) {
    try {
      let map = JSON.parse(d.secretsJson) as Record<string, string>;
      if (d.apiAppId && typeof map[d.apiAppId] === 'string') {
        return map[d.apiAppId];
      }
    } catch {
      // ignore invalid JSON
    }
  }
  return d.singleSecret ?? null;
};
