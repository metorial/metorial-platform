import { uniqueId } from '@lowerdeck/testing-tools';
import { expect } from 'vitest';
import { db } from '../src/db';
import { ares, anonymousAuth, authWithCookies } from './client';

export let DEVICE_COOKIE = 'metorial_ares_device_token';
export let SESSION_COOKIE = 'metorial_ares_session_id';
export let REDIRECT_URL = 'https://app.example.com/callback';

export let validPassword = 'Correct-Horse-Battery-9';

export let uniqueEmail = () => `${uniqueId('user').toLowerCase()}@example.com`;

export let expectRpcStatus = async (promise: Promise<unknown>, status: number) => {
  await expect(promise).rejects.toMatchObject({ data: { status } });
};

export let createApp = async (input: Partial<Parameters<typeof ares.app.create>[0]> = {}) =>
  ares.app.create({
    defaultRedirectUrl: REDIRECT_URL,
    slug: uniqueId('app').toLowerCase(),
    redirectDomains: ['example.com', '*.example.com'],
    ...input
  });

export let createDevice = async () => {
  let device = await anonymousAuth.device.ensure({});
  let cookie = `${device.deviceId}:${device.clientSecret}`;
  return { ...device, cookie, auth: authWithCookies({ [DEVICE_COOKIE]: cookie }) };
};

export let readEmailCode = async (stepId: string) => {
  let step = await db.authIntentStep.findUniqueOrThrow({ where: { id: stepId } });
  let code = await db.authIntentCode.findFirstOrThrow({
    where: { stepOid: step.oid },
    orderBy: { oid: 'desc' }
  });
  return code.code;
};

export let startEmailLogin = async (
  device: Awaited<ReturnType<typeof createDevice>>,
  input: { clientId: string; email: string }
) =>
  device.auth.authentication.start({
    type: 'email',
    clientId: input.clientId,
    email: input.email,
    redirectUrl: REDIRECT_URL
  });

export let signUp = async (
  app: { clientId: string },
  input: { email?: string; firstName?: string; lastName?: string } = {}
) => {
  let email = input.email ?? uniqueEmail();
  let device = await createDevice();

  let started = await startEmailLogin(device, { clientId: app.clientId, email });
  if (started.type != 'auth_intent')
    throw new Error(`Unexpected start result ${started.type}`);

  let intent = started.authIntent;
  let intentRef = { authIntentId: intent.id, clientSecret: intent.clientSecret };

  await device.auth.authIntent.verifyStep({
    ...intentRef,
    stepId: intent.steps[0]!.id,
    input: { type: 'email_code', code: await readEmailCode(intent.steps[0]!.id) }
  });

  await device.auth.authIntent.createUser({
    ...intentRef,
    input: {
      firstName: input.firstName ?? 'Test',
      lastName: input.lastName ?? 'User',
      acceptedTerms: true
    }
  });

  let attempt = await device.auth.authAttempt.create({
    from: 'auth_intent',
    authIntent: { id: intent.id, clientSecret: intent.clientSecret }
  });

  let exchanged = await device.auth.authAttempt.exchange({
    authAttemptId: attempt.id,
    clientSecret: attempt.clientSecret
  });

  let session = await ares.session.get({ sessionId: exchanged.sessionId });

  return {
    email,
    device,
    intent,
    attempt,
    sessionId: exchanged.sessionId,
    userId: session.userId,
    session,
    auth: authWithCookies({
      [DEVICE_COOKIE]: device.cookie,
      [SESSION_COOKIE]: exchanged.sessionId
    })
  };
};
