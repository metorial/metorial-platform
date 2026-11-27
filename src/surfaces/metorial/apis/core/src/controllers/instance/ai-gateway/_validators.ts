import { v } from '@lowerdeck/validation';

export let limitsValidator = v.array(
  v.object({
    metric: v.enumOf(['requests', 'tokens', 'spend_usd'], {
      description: 'What the limit counts. spend_usd counts what Metorial bills for requests.'
    }),
    amount: v.number({
      description: 'The most that can be used per interval',
      modifiers: [v.positive()]
    }),
    interval: v.enumOf(['1m', '1h', '1d', '1mo'], {
      description: 'The window the amount applies to'
    })
  }),
  {
    description:
      'Limits that reject requests once reached. Replaces the existing limits when updated.',
    modifiers: [v.maxLength(12)]
  }
);

export let allowedModelsValidator = v.array(
  v.string({ modifiers: [v.minLength(1), v.maxLength(200)] }),
  {
    description:
      'Models and virtual models the token can call, by slug. An empty list allows every model.',
    modifiers: [v.maxLength(200)]
  }
);

export let tokenMetadataValidator = v.record(v.string({ modifiers: [v.maxLength(256)] }), {
  description:
    'User-defined metadata that virtual model rules can read. Replaces existing metadata when updated.'
});
