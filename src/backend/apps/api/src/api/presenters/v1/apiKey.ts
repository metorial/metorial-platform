import { ApiKey } from '@metorial/db';
import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { apiKeyType } from '../types';
import { v1MachineAccessPresenter } from './machineAccess';

let keyRedactedLong = (apiKey: ApiKey) => {
  let [header, preview] = apiKey.secretRedacted.split('...');

  let idRandom = apiKey.id.slice(-10);
  let inner = new Array(apiKey.secretLength - header.length - preview.length)
    .fill(0)
    .map((_, i) => idRandom[i % idRandom.length])
    .join('');

  return `${header}${inner}${preview}`;
};

export let v1ApiKeyPresenter = Presenter.create(apiKeyType)
  .presenter(async ({ apiKey, secret }, opts) => ({
    id: apiKey.id,
    status: apiKey.status,
    type: apiKey.type,
    name: apiKey.name,
    description: apiKey.description,

    machine_access: await v1MachineAccessPresenter
      .present(
        {
          machineAccess: apiKey.machineAccess
        },
        opts
      )
      .run(),

    secret_redacted: apiKey.secretRedacted,
    secret_redacted_long: keyRedactedLong(apiKey),
    secret: secret?.secret ?? null,

    deleted_at: apiKey.deletedAt,
    last_used_at: apiKey.lastUsedAt,
    expires_at: apiKey.expiresAt,
    created_at: apiKey.createdAt,
    updated_at: apiKey.updatedAt
  }))
  .schema(
    v.object({
      id: v.string({ name: 'id', description: `The apiKey's unique identifier` }),
      status: v.enumOf(['active', 'deleted'], {
        name: 'status',
        description: `The apiKey's status`
      }),
      secret_redacted: v.string({
        name: 'secret_redacted',
        description: `The apiKey's secret, redacted`,
        examples: ['metorial_sk_4eC39HqLyjWDarjtT1zdp7dc']
      }),
      secret_redacted_long: v.string({
        name: 'secret_redacted_long',
        description: `The apiKey's secret, redacted with a long format`,
        examples: ['metorial_sk_4eC39HqLyjWDarjtT1zdp7dc']
      }),
      secret: v.nullable(
        v.string({
          name: 'secret',
          description: `The apiKey's secret`,
          examples: ['metorial_sk_4eC39HqLyjWDarjtT1zdp7dc']
        })
      ),
      type: v.enumOf(
        [
          'user_auth_token',
          'organization_management_token',
          'instance_access_token_secret',
          'instance_access_token_publishable'
        ],
        {
          name: 'type',
          description: `The apiKey's type`
        }
      ),
      name: v.string({
        name: 'name',
        description: `The apiKey's name`,
        examples: ['My API Key']
      }),
      description: v.nullable(
        v.string({
          name: 'description',
          description: `The apiKey's description`,
          examples: ['This is my API key']
        })
      ),
      machine_access: v1MachineAccessPresenter.schema,
      deleted_at: v.nullable(
        v.date({
          name: 'deleted_at',
          description: `The apiKey's deletion date`
        })
      ),
      last_used_at: v.nullable(
        v.date({
          name: 'last_used_at',
          description: `The apiKey's last usage date`
        })
      ),
      expires_at: v.nullable(
        v.date({
          name: 'expires_at',
          description: `The apiKey's expiration date`
        })
      ),
      created_at: v.date({ name: 'created_at', description: `The apiKey's creation date` }),
      updated_at: v.date({
        name: 'updated_at',
        description: `The apiKey's last update date`
      })
    })
  )
  .build();
