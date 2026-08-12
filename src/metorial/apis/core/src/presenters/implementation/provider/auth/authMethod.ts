import { shadowId } from '@lowerdeck/shadow-id';
import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import {
  type PresentedProviderAuthMethod,
  providerAuthMethodType,
  type RawProviderAuthMethod
} from '../../../types';

let isRawProviderAuthMethod = (
  authMethod: RawProviderAuthMethod | PresentedProviderAuthMethod
): authMethod is RawProviderAuthMethod => 'value' in authMethod;

export let v1ProviderAuthMethodPresenter = Presenter.create(providerAuthMethodType)
  .presenter(async ({ authMethod }) => {
    let rawAuthMethod = isRawProviderAuthMethod(authMethod) ? authMethod : null;
    let presentedAuthMethod = authMethod as PresentedProviderAuthMethod;
    let capabilities = rawAuthMethod
      ? rawAuthMethod.value.capabilities
      : presentedAuthMethod.capabilities;
    let inputJsonSchema = rawAuthMethod
      ? rawAuthMethod.value.inputJsonSchema
      : presentedAuthMethod.inputJsonSchema;
    let outputJsonSchema = rawAuthMethod
      ? rawAuthMethod.value.outputJsonSchema
      : presentedAuthMethod.outputJsonSchema;
    let scopes =
      authMethod.type === 'oauth'
        ? rawAuthMethod
          ? (rawAuthMethod.value.scopes ?? []).map(scope => ({
              object: 'provider.capabilities.auth_method.scope' as const,
              id: shadowId('pamsco_', [authMethod.id], [scope.id]),
              name: scope.title,
              scope: scope.id,
              description: scope.description ?? null
            }))
          : (presentedAuthMethod.scopes ?? []).map(scope => ({
              object: 'provider.capabilities.auth_method.scope' as const,
              id: scope.id,
              name: scope.title,
              scope: scope.scope,
              description: scope.description ?? null
            }))
        : null;

    return {
      object: 'provider.capabilities.auth_method' as const,
      id: authMethod.id,
      type: authMethod.type,

      key: authMethod.key,
      name: authMethod.name,
      description: authMethod.description,

      capabilities,

      input_schema: inputJsonSchema
        ? {
            type: 'json_schema',
            schema: inputJsonSchema
          }
        : null,
      output_schema: outputJsonSchema
        ? {
            type: 'json_schema',
            schema: outputJsonSchema
          }
        : null,

      scopes,

      provider_id: rawAuthMethod ? rawAuthMethod.provider.id : presentedAuthMethod.providerId,
      provider_specification_id: rawAuthMethod
        ? rawAuthMethod.specification.id
        : presentedAuthMethod.specificationId,

      created_at: authMethod.createdAt,
      updated_at: authMethod.updatedAt
    };
  })
  .schema(
    v.object({
      object: v.literal('provider.capabilities.auth_method', {
        description: "String representing the object's type"
      }),
      id: v.string({
        name: 'id',
        description: 'Unique auth method identifier',
        examples: ['pam_2mNpQrStUvWxYzAb']
      }),
      type: v.enumOf(['oauth', 'token', 'custom'], {
        name: 'type',
        description: 'Authentication type'
      }),
      key: v.string({
        name: 'key',
        description: 'Auth method key',
        examples: ['oauth2']
      }),
      name: v.string({ name: 'name', description: 'Display name', examples: ['OAuth 2.0'] }),
      description: v.nullable(
        v.string({
          name: 'description',
          description: 'Auth method description',
          examples: ['Authenticate using OAuth 2.0']
        })
      ),
      capabilities: v.record(v.any(), {
        name: 'capabilities',
        description: 'Auth method capabilities'
      }),
      input_schema: v.nullable(
        v.object({
          type: v.literal('json_schema'),
          schema: v.record(v.any(), {
            name: 'schema',
            description: 'JSON Schema defining the required auth input fields'
          })
        })
      ),
      output_schema: v.nullable(
        v.object({
          type: v.literal('json_schema'),
          schema: v.record(v.any(), {
            name: 'schema',
            description: 'JSON Schema defining the auth output fields'
          })
        })
      ),
      scopes: v.nullable(
        v.array(
          v.object({
            object: v.literal('provider.capabilities.auth_method.scope', {
              description: "String representing the object's type"
            }),
            id: v.string({
              name: 'id',
              description: 'Unique scope identifier',
              examples: ['pams_8tUvWxYzAbCdEfGh']
            }),
            scope: v.string({
              name: 'scope',
              description: 'OAuth scope string',
              examples: ['repo', 'user:email']
            }),
            name: v.string({
              name: 'name',
              description: 'Display name of the scope',
              examples: ['Repository Access']
            }),
            description: v.nullable(
              v.string({
                name: 'description',
                description: 'Scope description',
                examples: ['Full control of private repositories']
              })
            )
          }),
          {
            name: 'scopes',
            description: 'Available OAuth scopes'
          }
        )
      ),
      provider_id: v.string({
        name: 'provider_id',
        description: 'Provider ID',
        examples: ['pro_5gHjKlMnPqRsTuVw']
      }),
      provider_specification_id: v.string({
        name: 'provider_specification_id',
        description: 'Specification ID',
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
