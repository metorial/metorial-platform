import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import {
  type PresentedProviderTrigger,
  type RawProviderTrigger,
  providerTriggerType
} from '../../../types';

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
            }
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
            }
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
