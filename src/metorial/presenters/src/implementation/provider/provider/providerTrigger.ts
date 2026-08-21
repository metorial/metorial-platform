import { v, type ValidationType } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import {
  projectStoredSpecificationTriggerWebhookHttp,
  type SpecificationTriggerWebhookHttp
} from '@metorial-subspace/provider-utils';
import {
  type PresentedProviderTrigger,
  type RawProviderTrigger,
  providerTriggerType
} from '../../../types';

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
let httpMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const;
let registrationStatuses = [
  'pending',
  'registering',
  'registered',
  'renewing',
  'failed',
  'unregistering',
  'unregistered'
] as const;
let secretEncodings = ['utf8', 'hex', 'base64', 'base64url'] as const;
let presetFieldIds = [
  'timestamp',
  'delivery_id',
  'event_id',
  'subscription_id',
  'client_state',
  'resource',
  'webhook_id',
  'interaction_id',
  'issued_at'
] as const;
let presetIds = [
  'slack.v0',
  'stripe.v1',
  'zoom.v0',
  'hubspot.v3',
  'gitlab.standard.v1',
  'zendesk.v1',
  'typeform.v1',
  'linear.v1',
  'graph.change_notification.v1',
  'jira.oauth_dynamic_webhook.v1',
  'discord.interactions.v1'
] as const;
let providerVerifierIds = [
  'quickbooks.delivery.v1',
  'kofi.delivery.v1',
  'braintree.delivery.v1',
  'paypal.delivery.v1',
  'notion.delivery.v1',
  'asana.delivery.v1',
  'cursor.delivery.v1',
  'google_calendar.delivery.v1',
  'graph.change_notification.provider.v1',
  'meta.delivery.v1',
  'zoom.delivery.v1'
] as const;

let authSecretRefFields = {
  name: identifierSchema,
  credentialKey: secretKeySchema,
  authMethods: v.optional(v.array(identifierSchema)),
  encoding: v.enumOf([...secretEncodings])
};
let verificationSecretRefSchema = v.union([
  v.object({ source: v.literal('auth_config'), ...authSecretRefFields }),
  v.object({ source: v.literal('oauth_credentials'), ...authSecretRefFields }),
  v.object({
    source: v.literal('callback_secret'),
    name: identifierSchema,
    callbackSecretKey: secretKeySchema,
    encoding: v.enumOf([...secretEncodings])
  }),
  v.object({
    source: v.literal('registration'),
    name: identifierSchema,
    registrationKey: secretKeySchema,
    encoding: v.enumOf([...secretEncodings])
  }),
  v.object({
    source: v.literal('generated'),
    name: identifierSchema,
    binding: v.enumOf(['receiver', 'receiver_trigger'] as const),
    encoding: v.enumOf([...secretEncodings])
  })
]);

let requestMatcherSchema = v.object({
  method: v.optional(v.enumOf([...httpMethods])),
  hasQueryParam: v.optional(boundedNonEmptyValueSchema),
  lacksQueryParam: v.optional(boundedNonEmptyValueSchema),
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
let freshnessFields = {
  format: v.enumOf(['unix_seconds', 'unix_milliseconds', 'rfc3339'] as const),
  maxAgeSeconds: v.number({ modifiers: [v.integer(), v.minValue(1)] }),
  maxFutureSkewSeconds: v.number({ modifiers: [v.integer(), v.minValue(0)] })
};
let freshnessSchema = v.union([
  v.object({
    source: v.literal('preset'),
    presetField: v.enumOf([...presetFieldIds]),
    ...freshnessFields
  }),
  v.object({ source: v.literal('header'), headerName: httpTokenSchema, ...freshnessFields }),
  v.object({
    source: v.literal('json_pointer'),
    pointer: jsonPointerSchema,
    ...freshnessFields
  })
]);
let deduplicateFields = {
  ttlSeconds: v.number({ modifiers: [v.integer(), v.minValue(1)] }),
  scope: v.enumOf(['request', 'verified_item'] as const)
};
let deduplicateSchema = v.union([
  v.object({
    source: v.literal('preset'),
    presetField: v.enumOf([...presetFieldIds]),
    ...deduplicateFields
  }),
  v.object({ source: v.literal('header'), headerName: httpTokenSchema, ...deduplicateFields }),
  v.object({
    source: v.literal('json_pointer'),
    pointer: jsonPointerSchema,
    ...deduplicateFields
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
  v.object({ kind: v.literal('not_applicable'), reason: v.literal('bootstrap_sync_only') })
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
  prefix: v.optional(v.string({ modifiers: [v.maxLength(64)] })),
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
  v.object({ type: v.literal('preset'), preset: v.enumOf([...presetIds]) })
]);
let ruleResultSchema = v.union([
  v.object({ type: v.literal('sync_only') }),
  v.object({ type: v.literal('dispatch'), scope: v.literal('receiver_trigger') }),
  v.object({ type: v.literal('dispatch'), scope: v.literal('verified_items') })
]);
let ruleBaseSchema = {
  id: identifierSchema,
  phase: v.enumOf(['bootstrap', 'delivery', 'lifecycle'] as const),
  maxBodyBytes: v.optional(v.number({ modifiers: [v.integer(), v.positive()] })),
  when: v.object({
    methods: v.array(v.enumOf([...httpMethods])),
    registrationStatuses: v.optional(v.array(v.enumOf([...registrationStatuses]))),
    matcher: v.optional(requestMatcherSchema)
  }),
  result: ruleResultSchema,
  replay: v.optional(replaySchema)
};
let hubRuleSchema = v.object({ ...ruleBaseSchema, verify: hubVerifierSchema });
let providerRuleSchema = v.object({
  ...ruleBaseSchema,
  verify: v.object({
    type: v.literal('provider'),
    verifierId: v.enumOf([...providerVerifierIds]),
    allowedSecretRefs: v.array(identifierSchema),
    allowedBootstrapCaptureRefs: v.array(identifierSchema)
  })
});
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
    reason: boundedNonEmptyValueSchema,
    allowedSecretRefs: v.array(verificationSecretRefSchema),
    rules: v.array(providerRuleSchema)
  }),
  v.object({
    mechanism: v.literal('path_secret_only'),
    baseline: v.literal('receiver_path_secret'),
    reason: boundedNonEmptyValueSchema
  })
]);
type WebhookVerification = NonNullable<SpecificationTriggerWebhookHttp['verification']>;

let webhookVerificationSchema: ValidationType<WebhookVerification> = {
  type: webhookVerificationShapeSchema.type,
  items: webhookVerificationShapeSchema.items,
  name: webhookVerificationShapeSchema.name,
  description: webhookVerificationShapeSchema.description,
  validate: (value: unknown) => {
    try {
      let projected = projectStoredSpecificationTriggerWebhookHttp({ verification: value });
      if (!projected.verification) throw new TypeError('Verification is required');
      return v.success(projected.verification);
    } catch {
      return v.error([
        {
          code: 'invalid_webhook_verification_declaration',
          message: 'Invalid webhook verification declaration'
        }
      ]);
    }
  }
};

let isRawProviderTrigger = (
  trigger: RawProviderTrigger | PresentedProviderTrigger
): trigger is RawProviderTrigger => 'value' in trigger;

export let v1ProviderTriggerPresenter = Presenter.create(providerTriggerType)
  .presenter(async ({ trigger }) => {
    let rawTrigger = isRawProviderTrigger(trigger) ? trigger : null;
    let presentedTrigger = trigger as PresentedProviderTrigger;
    let inputJsonSchema = rawTrigger
      ? rawTrigger.value.inputJsonSchema
      : presentedTrigger.inputJsonSchema;
    let outputJsonSchema = rawTrigger
      ? rawTrigger.value.outputJsonSchema
      : presentedTrigger.outputJsonSchema;
    let eventTypes = rawTrigger
      ? (rawTrigger.value.eventTypes ?? [])
      : (presentedTrigger.eventTypes ?? []);
    let invocation = rawTrigger
      ? rawTrigger.value.invocation.type === 'polling'
        ? {
            type: 'polling' as const,
            interval_seconds: rawTrigger.value.invocation.intervalSeconds
          }
        : {
            type: 'webhook' as const,
            auto_registration: {
              status: rawTrigger.value.invocation.autoRegistration
                ? ('supported' as const)
                : ('unsupported' as const)
            },
            auto_unregistration: {
              status: rawTrigger.value.invocation.autoUnregistration
                ? ('supported' as const)
                : ('unsupported' as const)
            },
            http: projectStoredSpecificationTriggerWebhookHttp(
              rawTrigger.value.invocation.http
            )
          }
      : presentedTrigger.invocation.type === 'polling'
        ? {
            type: 'polling' as const,
            interval_seconds: presentedTrigger.invocation.intervalSeconds
          }
        : {
            type: 'webhook' as const,
            auto_registration: {
              status: presentedTrigger.invocation.autoRegistration.status
            },
            auto_unregistration: {
              status: presentedTrigger.invocation.autoUnregistration.status
            },
            http: projectStoredSpecificationTriggerWebhookHttp(
              presentedTrigger.invocation.http
            )
          };

    return {
      object: 'provider.capabilities.trigger' as const,
      id: trigger.id,

      key: trigger.key,
      name: trigger.name,
      description: trigger.description ?? null,

      input_schema: inputJsonSchema
        ? {
            type: 'json_schema' as const,
            schema: inputJsonSchema
          }
        : null,
      output_schema: outputJsonSchema
        ? {
            type: 'json_schema' as const,
            schema: outputJsonSchema
          }
        : null,

      event_types: eventTypes,

      invocation,

      provider_id: rawTrigger ? rawTrigger.provider.id : presentedTrigger.providerId,
      provider_specification_id: rawTrigger
        ? rawTrigger.specification.id
        : presentedTrigger.specificationId,

      created_at: trigger.createdAt,
      updated_at: trigger.updatedAt
    };
  })
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
