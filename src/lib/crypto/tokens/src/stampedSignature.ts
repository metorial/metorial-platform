import { getSigner, type Signer, type TokenKeys } from './tokens';

let MAX_FUTURE_SKEW_MS = 30_000;

export class StampedSignature {
  private signer: Signer;
  constructor(readonly keys: TokenKeys) {
    this.signer = getSigner(keys);
  }

  async sign(value: string, ts = Date.now()) {
    return { ts, sig: await this.signer.sign(`${ts}.${value}`) };
  }

  async verify(value: string, ts: number, sig: string, maxAgeMs: number) {
    if (!Number.isFinite(ts)) return false;
    if (ts > Date.now() + MAX_FUTURE_SKEW_MS) return false;
    if (Date.now() - ts > maxAgeMs) return false;

    try {
      return await this.signer.verify(`${ts}.${value}`, sig);
    } catch {
      return false;
    }
  }
}
