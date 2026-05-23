import { v } from '@mtsrc/validation';
import { getImageUrl } from '@metorial/db';
import { Presenter } from '@metorial/presenter';
import { publisherType } from '../../../types';

export let v1PublisherPresenter = Presenter.create(publisherType)
  .presenter(async ({ publisher }) => {
    return {
      object: 'provider.publisher' as const,
      id: publisher.id,

      name: publisher.name,
      description: publisher.description,

      image_url: await getImageUrl(publisher),

      created_at: publisher.createdAt,
      updated_at: publisher.updatedAt
    };
  })
  .schema(
    v.object({
      object: v.literal('provider.publisher', {
        description: "String representing the object's type"
      }),
      id: v.string({
        name: 'id',
        description: 'Unique publisher identifier',
        examples: ['pub_9hJkLmNpQrStUvWx']
      }),
      name: v.string({
        name: 'name',
        description: 'Display name of the publisher',
        examples: ['Acme Corp']
      }),
      description: v.nullable(
        v.string({
          name: 'description',
          description: 'Brief description of the publisher',
          examples: ['A leading provider of developer tools']
        })
      ),
      image_url: v.string({
        name: 'image_url',
        description: 'URL of the publisher logo',
        examples: ['https://cdn.metorial.com/images/acme.png']
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
