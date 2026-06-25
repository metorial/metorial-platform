import type {
  AuthIntent,
  AuthIntentCode,
  AuthIntentStep,
  UserIdentity
} from '../../../../prisma/generated/client';
import { env } from '../../../env';
import { turnstileVerifier } from '../../../lib/turnstile';

let getStatus = (authIntent: AuthIntent) => {
  if (!authIntent.verifiedAt) return 'needs_verification' as const;
  if (!authIntent.userOid) return 'needs_user' as const;
  if (turnstileVerifier.enabled && !authIntent.captchaVerifiedAt)
    return 'needs_captcha' as const;
  if (!authIntent.consumedAt) return 'verified' as const;
  return 'consumed' as const;
};

export let authIntentPresenter = (
  authIntent: AuthIntent & {
    steps: (AuthIntentStep & { codes: AuthIntentCode[] })[];
    userIdentity: UserIdentity | null;
  }
) => {
  let sortedSteps = authIntent.steps.sort(
    (a: AuthIntentStep, b: AuthIntentStep) => a.index - b.index
  );
  let lastVerifiedStep = [...sortedSteps].reverse().findIndex(step => step.verifiedAt);
  let nextStepIndex = lastVerifiedStep + 1;

  return {
    object: 'ares#auth_intent',

    id: authIntent.id,
    clientSecret: authIntent.clientSecret,

    status: getStatus(authIntent),

    type: authIntent.type,
    redirectUrl: authIntent.redirectUrl,

    identifier: {
      type: authIntent.identifierType,
      value: authIntent.identifier
    },

    steps: authIntent.steps.map(
      (step: AuthIntentStep & { codes: AuthIntentCode[] }, i: number) => ({
        object: 'ares#auth_intent.step',

        id: step.id,
        index: step.index,
        status:
          nextStepIndex == i
            ? ('current' as const)
            : step.verifiedAt
              ? ('complete' as const)
              : ('pending' as const),

        email: step.email,
        type: step.type,

        createdAt: step.createdAt,
        updatedAt: step.updatedAt,
        verifiedAt: step.verifiedAt,

        codes: step.codes.map((code: AuthIntentCode) => ({
          object: 'ares#auth_intent.code',

          id: code.id,
          code: '••••••',
          email: code.email,
          createdAt: code.createdAt
        }))
      })
    ),

    captcha:
      turnstileVerifier.enabled && env.turnstile.TURNSTILE_SITE_KEY
        ? {
            object: 'ares#auth_intent.captcha' as const,

            status: authIntent.captchaVerifiedAt
              ? ('complete' as const)
              : ('pending' as const),
            siteKey: env.turnstile.TURNSTILE_SITE_KEY,

            createdAt: authIntent.createdAt,
            updatedAt: authIntent.captchaVerifiedAt ?? authIntent.createdAt
          }
        : null,

    userCreationPrefill: {
      object: 'ares#auth_intent.user_creation_prefill',

      firstName: authIntent.userIdentity?.firstName,
      lastName: authIntent.userIdentity?.lastName
    },

    createdAt: authIntent.createdAt,
    updatedAt: authIntent.updatedAt
  };
};
