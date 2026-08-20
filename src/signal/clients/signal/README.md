# Signal client

## Verifying callback deliveries

Metorial signs the exact callback body in the `Metorial-Signature` header. Read the body
before parsing it and verify it with the signing secret revealed when the destination secret
is rotated:

```ts
import { verifyMetorialSignature } from '@metorial-platform-systems/signal-client';

let rawBody = new Uint8Array(await request.arrayBuffer());
let valid = await verifyMetorialSignature({
  header: request.headers.get('metorial-signature') ?? '',
  body: rawBody,
  signingSecrets: [process.env.METORIAL_WEBHOOK_SECRET!]
});

if (!valid) return new Response('Invalid signature', { status: 401 });
```

The default freshness policy rejects signatures older than five minutes or more than one
minute in the future. During secret rotation the header can contain multiple `v1` signatures;
the verifier accepts a match for any supplied active or retiring secret.

Use `Metorial-Notification-Id` as an idempotency key so a valid retry is processed once.
