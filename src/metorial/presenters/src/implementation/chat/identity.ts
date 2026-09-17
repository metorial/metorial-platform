import { v } from '@lowerdeck/validation';
import { type ChatAuthor } from '@metorial-subspace/db';
import { getImageUrl } from '@metorial/db';

export let chatIdentitySchema = v.nullable(
  v.object(
    {
      id: v.string({
        name: 'id',
        description: 'Unique chat author identifier',
        examples: ['cau_7dEfGhJkLmNpQrSt']
      }),
      user_id: v.string({
        name: 'user_id',
        description: 'The provider-side user or app id this connection is authorized as',
        examples: ['U0123ABC']
      }),
      name: v.string({
        name: 'name',
        description: 'Display name of the authorized identity',
        examples: ['Metorial Bot']
      }),
      username: v.string({
        name: 'username',
        description: 'Username or handle of the authorized identity',
        examples: ['metorial-bot']
      }),
      provider_type: v.string({
        name: 'provider_type',
        description:
          'The kind of identity as classified by the provider, e.g. a human user vs. an app/bot',
        examples: ['app']
      }),
      email: v.nullable(
        v.string({
          name: 'email',
          description: 'Email address of the authorized identity, if available',
          examples: ['bot@acme.slack.com']
        })
      ),
      image_url: v.nullable(
        v.string({
          name: 'image_url',
          description: 'Avatar or image URL of the authorized identity, if available',
          examples: ['https://avatars.slack-edge.com/2026-01-10/bot_512.png']
        })
      )
    },
    {
      name: 'identity',
      description:
        'The identity this connection is authorized as on the chat provider (e.g. the connected bot or user). Null until this account has been observed on the provider (e.g. through a synced message or channel membership).'
    }
  )
);

export let presentChatIdentity = async (author: ChatAuthor | null | undefined) =>
  author
    ? {
        id: author.id,
        user_id: author.userId,
        name: author.fullName,
        username: author.userName,
        provider_type: author.providerType,
        email: author.email,
        image_url: author.imageUrl
          ? await getImageUrl({
              id: author.id,
              name: author.fullName,
              email: author.email,
              image: { type: 'url', url: author.imageUrl }
            })
          : null
      }
    : null;
