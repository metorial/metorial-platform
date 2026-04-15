import { getSentry } from '@lowerdeck/sentry';

let Sentry = getSentry();

export class TurnstileVerifier {
  constructor(private secretKey: string | undefined) {}

  get enabled() {
    return !!this.secretKey;
  }

  async verify({ token }: { token: string }) {
    if (!this.secretKey) return true;
    if (process.env.NODE_ENV === 'development') return true;

    try {
      let res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          secret: this.secretKey,
          response: token
        })
      });

      let data = (await res.json()) as { success: boolean; challenge_ts: string };

      return data.success && Date.now() - new Date(data.challenge_ts).getTime() <= 1000 * 60;
    } catch (err) {
      Sentry.captureException(err);
      // If cloudflare is down, we should still allow the user to sign up

      console.error(err);
      return true;
    }
  }
}

export let turnstileVerifier = new TurnstileVerifier(
  process.env.TURNSTILE_SECRET_KEY || undefined
);
