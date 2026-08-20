import { v, type ValidationType } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { projectStoredSpecificationTriggerWebhookHttp } from '@metorial-subspace/provider-utils/src/types/webhookVerification';
import {
  SLATE_WEBHOOK_HTTP_METHODS,
  SLATE_WEBHOOK_PRESET_FIELD_IDS,
  SLATE_WEBHOOK_PRESET_IDS,
  SLATE_WEBHOOK_PROVIDER_VERIFIER_IDS,
  SLATE_WEBHOOK_REGISTRATION_STATUSES,
  SLATE_WEBHOOK_SECRET_ENCODINGS,
  slatesWebhookVerification,
  type SlateWebhookVerification
} from '@slates/proto';
import { providerTriggerType } from '../../../types';

let mutableEnumTuple = <const Values extends readonly [string, ...string[]]>(
  values: Values
): [...Values] => [...values];

let webhookHttpMethods = mutableEnumTuple(SLATE_WEBHOOK_HTTP_METHODS);
let webhookPresetFieldIds = mutableEnumTuple(SLATE_WEBHOOK_PRESET_FIELD_IDS);
let webhookPresetIds = mutableEnumTuple(SLATE_WEBHOOK_PRESET_IDS);
let webhookProviderVerifierIds = mutableEnumTuple(SLATE_WEBHOOK_PROVIDER_VERIFIER_IDS);
let webhookRegistrationStatuses = mutableEnumTuple(SLATE_WEBHOOK_REGISTRATION_STATUSES);
let webhookSecretEncodings = mutableEnumTuple(SLATE_WEBHOOK_SECRET_ENCODINGS);

let identifierSchema = v.string({
  modifiers: [
    v.minLength(1),
    v.maxLength(128),
    v.regex(/^[A-Za-z0-9](?:[A-Za-z0-9._:/-]*[A-Za-z0-9])?$/)
  ]
});
let secretKeySchema = v.string({
  modifiers: [
    v.minLength(1),
    v.maxLength(128),
    v.regex(/^[A-Za-z0-9](?:[A-Za-z0-9._:-]*[A-Za-z0-9])?$/)
  ]
});
let httpTokenSchema = v.string({
  modifiers: [v.minLength(1), v.maxLength(512), v.regex(/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/)]
});
let boundedValueSchema = v.string({ modifiers: [v.maxLength(512)] });
let boundedNonEmptyValueSchema = v.string({
  modifiers: [v.minLength(1), v.maxLength(512)]
});
let jsonPointerSchema = v.string({
  modifiers: [v.minLength(1), v.maxLength(512), v.startsWith('/')]
});
let freshnessMaxAgeSchema = v.number({
  modifiers: [v.integer(), v.minValue(1), v.maxValue(31_536_000)]
});
let freshnessFutureSkewSchema = v.number({
  modifiers: [v.integer(), v.minValue(0), v.maxValue(86_400)]
});
let deduplicateTtlSchema = v.number({
  modifiers: [v.integer(), v.minValue(1), v.maxValue(31_536_000)]
});
let reasonSchema = v.string({ modifiers: [v.minLength(1), v.maxLength(512)] });

let verificationSecretRefSchema = v.union([
  v.object({
    source: v.literal('registration'),
    name: identifierSchema,
    registrationKey: secretKeySchema,
    encoding: v.enumOf(webhookSecretEncodings)
  }),
  v.object({
    source: v.literal('generated'),
    name: identifierSchema,
    binding: v.enumOf(['receiver', 'receiver_trigger'] as const),
    encoding: v.enumOf(webhookSecretEncodings)
  }),
  v.object({
    source: v.literal('config'),
    name: identifierSchema,
    configKey: secretKeySchema,
    encoding: v.enumOf(webhookSecretEncodings)
  }),
  v.object({
    source: v.literal('platform'),
    name: identifierSchema,
    credentialKey: secretKeySchema,
    encoding: v.enumOf(webhookSecretEncodings)
  })
]);

let requestMatcherSchema = v.object({
  method: v.optional(v.enumOf(webhookHttpMethods)),
  hasQueryParam: v.optional(boundedNonEmptyValueSchema),
  hasHeader: v.optional(httpTokenSchema),
  jsonBodyField: v.optional(
    v.object({
      path: boundedNonEmptyValueSchema,
      equals: v.optional(boundedValueSchema)
    })
  ),
  formBodyField: v.optional(
    v.object({
      path: boundedNonEmptyValueSchema,
      equals: v.optional(boundedValueSchema)
    })
  )
});

let freshnessSchema = v.union([
  v.object({
    source: v.literal('preset'),
    presetField: v.enumOf(webhookPresetFieldIds),
    format: v.enumOf(['unix_seconds', 'unix_milliseconds', 'rfc3339'] as const),
    maxAgeSeconds: freshnessMaxAgeSchema,
    maxFutureSkewSeconds: freshnessFutureSkewSchema
  }),
  v.object({
    source: v.literal('header'),
    headerName: httpTokenSchema,
    format: v.enumOf(['unix_seconds', 'unix_milliseconds', 'rfc3339'] as const),
    maxAgeSeconds: freshnessMaxAgeSchema,
    maxFutureSkewSeconds: freshnessFutureSkewSchema
  }),
  v.object({
    source: v.literal('json_pointer'),
    pointer: jsonPointerSchema,
    format: v.enumOf(['unix_seconds', 'unix_milliseconds', 'rfc3339'] as const),
    maxAgeSeconds: freshnessMaxAgeSchema,
    maxFutureSkewSeconds: freshnessFutureSkewSchema
  })
]);

let deduplicateSchema = v.union([
  v.object({
    source: v.literal('preset'),
    presetField: v.enumOf(webhookPresetFieldIds),
    ttlSeconds: deduplicateTtlSchema,
    scope: v.enumOf(['request', 'verified_item'] as const)
  }),
  v.object({
    source: v.literal('header'),
    headerName: httpTokenSchema,
    ttlSeconds: deduplicateTtlSchema,
    scope: v.enumOf(['request', 'verified_item'] as const)
  }),
  v.object({
    source: v.literal('json_pointer'),
    pointer: jsonPointerSchema,
    ttlSeconds: deduplicateTtlSchema,
    scope: v.enumOf(['request', 'verified_item'] as const)
  })
]);

let replaySchema = v.union([
  v.object({
    kind: v.literal('enforced'),
    freshness: freshnessSchema,
    deduplicate: v.optional(deduplicateSchema)
  }),
  v.object({
    kind: v.literal('enforced'),
    freshness: v.optional(freshnessSchema),
    deduplicate: deduplicateSchema
  }),
  v.object({
    kind: v.literal('not_applicable'),
    reason: v.literal('bootstrap_sync_only')
  })
]);

let staticTokenSelectorSchema = v.union([
  v.object({ source: v.literal('header'), headerName: httpTokenSchema }),
  v.object({ source: v.literal('query'), queryParam: boundedNonEmptyValueSchema }),
  v.object({ source: v.literal('json_pointer'), pointer: jsonPointerSchema })
]);

let messagePartSchema = v.union([
  v.object({ source: v.literal('body') }),
  v.object({ source: v.literal('method') }),
  v.object({ source: v.literal('url') }),
  v.object({ source: v.literal('header'), headerName: httpTokenSchema }),
  v.object({ source: v.literal('query'), queryParam: boundedNonEmptyValueSchema }),
  v.object({ source: v.literal('literal'), value: boundedValueSchema })
]);

let signatureSourceSchema = v.object({
  headerName: httpTokenSchema,
  encoding: v.enumOf(['hex', 'base64', 'base64url'] as const),
  prefix: v.optional(v.string({ modifiers: [v.maxLength(64), v.regex(/^[A-Za-z0-9._-]*$/)] })),
  duplicateHeaderPolicy: v.enumOf(['reject', 'allow_identical', 'preserve'] as const),
  multipleSignaturePolicy: v.enumOf(['reject', 'any_valid', 'all_valid'] as const)
});

let hubVerifierSchema = v.union([
  v.object({ type: v.literal('path_secret') }),
  v.object({
    type: v.literal('static_token'),
    secretName: identifierSchema,
    selector: staticTokenSelectorSchema
  }),
  v.object({
    type: v.literal('raw_hmac'),
    secretName: identifierSchema,
    algorithm: v.enumOf(['sha256', 'sha512'] as const),
    signature: signatureSourceSchema,
    message: v.array(messagePartSchema)
  }),
  v.object({
    type: v.literal('ed25519'),
    publicKeyName: identifierSchema,
    publicKeyEncoding: v.enumOf(['hex', 'base64', 'base64url'] as const),
    signature: signatureSourceSchema,
    message: v.array(messagePartSchema)
  }),
  v.object({
    type: v.literal('preset'),
    preset: v.enumOf(webhookPresetIds)
  })
]);

let ruleResultSchema = v.union([
  v.object({ type: v.literal('sync_only') }),
  v.object({ type: v.literal('dispatch'), scope: v.literal('receiver_trigger') }),
  v.object({ type: v.literal('dispatch'), scope: v.literal('verified_items') })
]);

let ruleBaseSchema = {
  id: identifierSchema,
  phase: v.enumOf(['bootstrap', 'delivery', 'lifecycle'] as const),
  maxBodyBytes: v.optional(
    v.number({ modifiers: [v.integer(), v.positive(), v.maxValue(10 * 1024 * 1024)] })
  ),
  when: v.object({
    methods: v.array(v.enumOf(webhookHttpMethods)),
    registrationStatuses: v.optional(v.array(v.enumOf(webhookRegistrationStatuses))),
    matcher: v.optional(requestMatcherSchema)
  }),
  result: ruleResultSchema,
  replay: v.optional(replaySchema)
};

let hubRuleSchema = v.object({
  ...ruleBaseSchema,
  verify: hubVerifierSchema
});

let providerRuleSchema = v.object({
  ...ruleBaseSchema,
  verify: v.object({
    type: v.literal('provider'),
    verifierId: v.enumOf(webhookProviderVerifierIds),
    allowedSecretRefs: v.array(identifierSchema),
    allowedBootstrapCaptureRefs: v.array(identifierSchema)
  })
});

// Keep this declaration in the provider protocol's camel-case wire shape. Runtime projection
// uses the canonical @slates/proto parser, which also owns all cross-field and bounded/non-empty
// invariants that @lowerdeck/validation cannot express in documentation.
let webhookVerificationShapeSchema = v.union([
  v.object({
    mechanism: v.literal('hub'),
    baseline: v.literal('receiver_path_secret'),
    allowedSecretRefs: v.array(verificationSecretRefSchema),
    rules: v.array(hubRuleSchema)
  }),
  v.object({
    mechanism: v.literal('provider'),
    baseline: v.literal('receiver_path_secret'),
    reason: reasonSchema,
    allowedSecretRefs: v.array(verificationSecretRefSchema),
    rules: v.array(providerRuleSchema)
  }),
  v.object({
    mechanism: v.literal('path_secret_only'),
    baseline: v.literal('receiver_path_secret'),
    reason: reasonSchema
  })
]);

// Preserve the field-level protocol shape for generated API documentation while making the
// canonical strict parser authoritative for closed objects, non-empty ordered rules, bounds,
// cross-field rules, and exact SecretRefs at runtime.
let webhookVerificationSchema: ValidationType<SlateWebhookVerification> = {
  type: webhookVerificationShapeSchema.type,
  items: webhookVerificationShapeSchema.items,
  name: webhookVerificationShapeSchema.name,
  description: webhookVerificationShapeSchema.description,
  validate: (value: unknown) => {
    let parsed = slatesWebhookVerification.safeParse(value);
    if (!parsed.success) {
      return v.error([
        {
          code: 'invalid_webhook_verification_declaration',
          message: 'Invalid webhook verification declaration'
        }
      ]);
    }
    return v.success(parsed.data);
  }
};

export let v1ProviderTriggerPresenter = Presenter.create(providerTriggerType)
  .presenter(async ({ trigger }) => ({
    object: 'provider.capabilities.trigger' as const,
    id: trigger.id,

    key: trigger.key,
    name: trigger.name,
    description: trigger.description ?? null,

    input_schema: trigger.inputJsonSchema
      ? {
          type: 'json_schema' as const,
          schema: trigger.inputJsonSchema
        }
      : null,
    output_schema: trigger.outputJsonSchema
      ? {
          type: 'json_schema' as const,
          schema: trigger.outputJsonSchema
        }
      : null,

    event_types: trigger.eventTypes,

    invocation:
      trigger.invocation.type === 'polling'
        ? {
            type: 'polling' as const,
            interval_seconds: trigger.invocation.intervalSeconds
          }
        : {
            type: 'webhook' as const,
            auto_registration: {
              status: trigger.invocation.autoRegistration ? 'supported' : 'unsupported'
            },
            auto_unregistration: {
              status: trigger.invocation.autoUnregistration ? 'supported' : 'unsupported'
            },
            http: {
              verification: projectStoredSpecificationTriggerWebhookHttp(
                (trigger.invocation as { http?: unknown }).http
              ).verification
            }
          },

    provider_id: trigger.providerId,
    provider_specification_id: trigger.specificationId,

    created_at: trigger.createdAt,
    updated_at: trigger.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('provider.capabilities.trigger', {
        description: "String representing the object's type"
      }),
      id: v.string({
        name: 'id',
        description: 'Unique provider trigger identifier',
        examples: ['ptr_4nOpQrStUvWxYzAb']
      }),
      key: v.string({
        name: 'key',
        description: 'Trigger key used when subscribing callbacks',
        examples: ['messages.created']
      }),
      name: v.string({
        name: 'name',
        description: 'Display name of the trigger',
        examples: ['Messages Created']
      }),
      description: v.nullable(
        v.string({
          name: 'description',
          description: 'Trigger description',
          examples: ['Fires whenever a new message is created in the provider']
        })
      ),
      input_schema: v.nullable(
        v.object({
          type: v.literal('json_schema'),
          schema: v.record(v.any(), {
            name: 'schema',
            description: 'JSON Schema defining the trigger payload input shape'
          })
        })
      ),
      output_schema: v.nullable(
        v.object({
          type: v.literal('json_schema'),
          schema: v.record(v.any(), {
            name: 'schema',
            description: 'JSON Schema defining the trigger delivery output shape'
          })
        })
      ),
      event_types: v.array(
        v.string({
          name: 'event_type',
          description: 'Event type emitted by this provider trigger',
          examples: ['message.created']
        }),
        {
          name: 'event_types',
          description: 'Event types that can be emitted by this provider trigger'
        }
      ),
      invocation: v.union([
        v.object({
          type: v.literal('polling'),
          interval_seconds: v.number({
            name: 'interval_seconds',
            description: 'Polling interval in seconds for polling-based triggers',
            examples: [60]
          })
        }),
        v.object({
          type: v.literal('webhook'),
          auto_registration: v.object({
            status: v.enumOf(['supported', 'unsupported'] as const, {
              name: 'status',
              description: 'Whether automatic webhook registration is supported'
            })
          }),
          auto_unregistration: v.object({
            status: v.enumOf(['supported', 'unsupported'] as const, {
              name: 'status',
              description: 'Whether automatic webhook removal is supported'
            })
          }),
          http: v.object({
            verification: v.nullable(webhookVerificationSchema)
          })
        })
      ]),
      provider_id: v.string({
        name: 'provider_id',
        description: 'Provider ID',
        examples: ['pro_5gHjKlMnPqRsTuVw']
      }),
      provider_specification_id: v.string({
        name: 'provider_specification_id',
        description: 'Provider specification ID',
        examples: ['psp_9gHjKlMnPqRsTuVw']
      }),
      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when created',
        examples: [new Date('2025-09-15T10:30:00Z')]
      }),
      updated_at: v.date({
        name: 'updated_at',
        description: 'Timestamp when last updated',
        examples: [new Date('2026-01-10T14:45:00Z')]
      })
    })
  )
  .build();
