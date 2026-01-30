import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { authMethodType } from '../../types';

let authMethodScopeSchema = v.object({
  object: v.literal('provider.auth_method.scope', { description: "String representing the object's type" }),
  id: v.string({ name: 'id', description: 'Unique scope identifier', examples: ['pams_8tUvWxYzAbCdEfGh'] }),
  scope: v.string({ name: 'scope', description: 'OAuth scope string', examples: ['repo', 'user:email'] }),
  name: v.string({ name: 'name', description: 'Display name of the scope', examples: ['Repository Access'] }),
  description: v.nullable(v.string({ name: 'description', description: 'Scope description', examples: ['Full control of private repositories'] }))
});

export let v1AuthMethodPresenter = Presenter.create(authMethodType)
  .presenter(async ({ authMethod }) => ({
    object: 'provider.auth_method' as const,
    id: authMethod.id,
    type: authMethod.type,
    name: authMethod.name,
    description: authMethod.description,
    input_schema: authMethod.inputSchema ?? authMethod.inputJsonSchema,
    scopes:
      authMethod.scopes?.map(scope => ({
        object: 'provider.auth_method.scope' as const,
        id: scope.id,
        scope: scope.scope,
        name: scope.title ?? scope.name,
        description: scope.description
      })) ?? null,
    provider_id: authMethod.providerId,
    provider_specification_id: authMethod.providerSpecificationId ?? authMethod.specificationId,
    created_at: authMethod.createdAt,
    updated_at: authMethod.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('provider.auth_method', { description: "String representing the object's type" }),
      id: v.string({ name: 'id', description: 'Unique auth method identifier', examples: ['pam_2mNpQrStUvWxYzAb'] }),
      type: v.enumOf(['oauth', 'token', 'custom'], { name: 'type', description: 'Authentication type' }),
      name: v.string({ name: 'name', description: 'Display name', examples: ['OAuth 2.0'] }),
      description: v.nullable(v.string({ name: 'description', description: 'Auth method description', examples: ['Authenticate using OAuth 2.0'] })),
      input_schema: v.nullable(
        v.record(v.any(), {
          name: 'input_schema',
          description: 'JSON Schema defining the required auth input fields. Contains standard JSON Schema fields like type, properties, required, etc.',
          examples: [
            {
              type: 'object',
              properties: {
                client_id: { type: 'string', description: 'OAuth client ID' },
                client_secret: { type: 'string', description: 'OAuth client secret' }
              },
              required: ['client_id', 'client_secret']
            }
          ]
        })
      ),
      scopes: v.nullable(
        v.array(authMethodScopeSchema, { name: 'scopes', description: 'Available OAuth scopes' })
      ),
      provider_id: v.string({ name: 'provider_id', description: 'Provider ID', examples: ['pro_5gHjKlMnPqRsTuVw'] }),
      provider_specification_id: v.string({
        name: 'provider_specification_id',
        description: 'Specification ID',
        examples: ['psp_9gHjKlMnPqRsTuVw']
      }),
      created_at: v.date({ name: 'created_at', description: 'Timestamp when created', examples: [new Date('2025-09-15T10:30:00Z')] }),
      updated_at: v.date({ name: 'updated_at', description: 'Timestamp when last updated', examples: [new Date('2026-01-10T14:45:00Z')] })
    })
  )
  .build();
