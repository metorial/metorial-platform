import { getImageUrl } from '@metorial/db';
import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { userType } from '../types';

export let v1UserPresenter = Presenter.create(userType)
  .presenter(async ({ user }, opts) => ({
    object: 'user',

    id: user.id,
    status: user.status,
    type: user.type,
    email: user.email,
    first_name: user.firstName,
    last_name: user.lastName,
    name: user.name,
    image_url: getImageUrl(user),
    created_at: user.createdAt,
    updated_at: user.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('user'),

      id: v.string({ name: 'id', description: `The user's unique identifier` }),
      status: v.enumOf(['active', 'deleted'], {
        name: 'status',
        description: `The user's status`
      }),
      type: v.enumOf(['user'], {
        name: 'type',
        description: `The user's type`
      }),
      email: v.string({
        name: 'email',
        description: `The user's email address`,
        examples: ['sam@example.com']
      }),
      name: v.string({
        name: 'name',
        description: `The user's name`,
        examples: ['Sam']
      }),
      first_name: v.string({
        name: 'first_name',
        description: `The user's first name`,
        examples: ['Sam']
      }),
      last_name: v.string({
        name: 'last_name',
        description: `The user's last name`,
        examples: ['Smith']
      }),
      image_url: v.string({
        name: 'imageUrl',
        description: `The user's image URL`,
        examples: ['https://avatar-cdn.metorial.com/aimg_1234567890']
      }),
      created_at: v.date({ name: 'created_at', description: `The user's creation date` }),
      updated_at: v.date({
        name: 'updated_at',
        description: `The user's last update date`
      })
    })
  )
  .build();
