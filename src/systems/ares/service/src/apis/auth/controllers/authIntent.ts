import { notFoundError, ServiceError } from '@lowerdeck/error';
import { v } from '@lowerdeck/validation';
import { authService } from '../../../services/auth';
import { publicApp } from '../_app';
import { authIntentApp } from '../middleware/authIntent';
import { authIntentPresenter } from '../presenters';

export let authIntentController = publicApp.controller({
  get: authIntentApp
    .handler()
    .input(
      v.object({
        authIntentId: v.string(),
        clientSecret: v.string()
      })
    )
    .do(async ({ authIntent }) => {
      return authIntentPresenter(authIntent);
    }),

  verifyCaptcha: authIntentApp
    .handler()
    .input(
      v.object({
        authIntentId: v.string(),
        clientSecret: v.string(),
        token: v.string()
      })
    )
    .do(async ({ authIntent, input }) => {
      await authService.verifyCaptcha({
        authIntent,
        token: input.token
      });

      return authIntentPresenter(
        await authService.getAuthIntent({
          authIntentId: authIntent.id,
          clientSecret: authIntent.clientSecret
        })
      );
    }),

  verifyStep: authIntentApp
    .handler()
    .input(
      v.object({
        authIntentId: v.string(),
        clientSecret: v.string(),

        stepId: v.string({ modifiers: [v.maxLength(150)] }),

        input: v.object({
          type: v.literal('email_code'),
          code: v.string({ modifiers: [v.maxLength(150)] })
        })
      })
    )
    .do(async ({ authIntent, input }) => {
      let step = authIntent.steps.find(step => step.id == input.stepId);
      if (!step) throw new ServiceError(notFoundError('auth_intent_step'));

      await authService.verifyAuthIntentStep({
        step,
        input: input.input
      });

      return authIntentPresenter(
        await authService.getAuthIntent({
          authIntentId: authIntent.id,
          clientSecret: authIntent.clientSecret
        })
      );
    }),

  resendStep: authIntentApp
    .handler()
    .input(
      v.object({
        authIntentId: v.string(),
        clientSecret: v.string(),

        stepId: v.string({ modifiers: [v.maxLength(150)] })
      })
    )
    .do(async ({ authIntent, input }) => {
      let step = authIntent.steps.find(step => step.id == input.stepId);
      if (!step) throw new ServiceError(notFoundError('auth_intent_step'));

      await authService.resendAuthIntentCode({
        authIntent,
        step
      });

      return authIntentPresenter(
        await authService.getAuthIntent({
          authIntentId: authIntent.id,
          clientSecret: authIntent.clientSecret
        })
      );
    }),

  createUser: authIntentApp
    .handler()
    .input(
      v.object({
        authIntentId: v.string(),
        clientSecret: v.string(),

        input: v.object({
          firstName: v.string(),
          lastName: v.string(),
          acceptedTerms: v.boolean()
        })
      })
    )
    .do(async ({ authIntent, app, input }) => {
      await authService.createUserForAuthIntent({
        authIntent,
        app,
        input: {
          firstName: input.input.firstName,
          lastName: input.input.lastName,
          acceptedTerms: input.input.acceptedTerms
        }
      });

      return authIntentPresenter(
        await authService.getAuthIntent({
          authIntentId: authIntent.id,
          clientSecret: authIntent.clientSecret
        })
      );
    })
});
