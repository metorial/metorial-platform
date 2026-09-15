import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceChatsMessagesReactionsCreateOutput = {
  object: 'chat.reaction_list';
  reactions: {
    emoji:
      | { type: 'unicode'; value: string }
      | {
          type: 'custom';
          name: string;
          url?: string | undefined;
          id?: string | undefined;
        };
    count: number;
    authors?:
      | {
          userId: string;
          userName: string;
          fullName: string;
          type: 'user' | 'app' | 'system' | 'webhook' | 'unknown';
          role?: 'member' | 'guest' | 'unknown' | undefined;
          providerType?: string | undefined;
          isMe: boolean;
          email?: string | undefined;
          imageUrl?: string | undefined;
          raw?: any | undefined;
        }[]
      | undefined;
  }[];
};

export let mapManagementInstanceChatsMessagesReactionsCreateOutput =
  mtMap.object<ManagementInstanceChatsMessagesReactionsCreateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    reactions: mtMap.objectField(
      'reactions',
      mtMap.array(
        mtMap.object({
          emoji: mtMap.objectField(
            'emoji',
            mtMap.union([
              mtMap.unionOption(
                'object',
                mtMap.object({
                  type: mtMap.objectField('type', mtMap.passthrough()),
                  value: mtMap.objectField('value', mtMap.passthrough()),
                  name: mtMap.objectField('name', mtMap.passthrough()),
                  url: mtMap.objectField('url', mtMap.passthrough()),
                  id: mtMap.objectField('id', mtMap.passthrough())
                })
              )
            ])
          ),
          count: mtMap.objectField('count', mtMap.passthrough()),
          authors: mtMap.objectField(
            'authors',
            mtMap.array(
              mtMap.object({
                userId: mtMap.objectField('userId', mtMap.passthrough()),
                userName: mtMap.objectField('userName', mtMap.passthrough()),
                fullName: mtMap.objectField('fullName', mtMap.passthrough()),
                type: mtMap.objectField('type', mtMap.passthrough()),
                role: mtMap.objectField('role', mtMap.passthrough()),
                providerType: mtMap.objectField(
                  'providerType',
                  mtMap.passthrough()
                ),
                isMe: mtMap.objectField('isMe', mtMap.passthrough()),
                email: mtMap.objectField('email', mtMap.passthrough()),
                imageUrl: mtMap.objectField('imageUrl', mtMap.passthrough()),
                raw: mtMap.objectField('raw', mtMap.passthrough())
              })
            )
          )
        })
      )
    )
  });

export type ManagementInstanceChatsMessagesReactionsCreateBody = {
  channelId: string;
  emoji:
    | string
    | { type: 'unicode'; value: string }
    | {
        type: 'custom';
        name: string;
        url?: string | undefined;
        id?: string | undefined;
      };
};

export let mapManagementInstanceChatsMessagesReactionsCreateBody =
  mtMap.object<ManagementInstanceChatsMessagesReactionsCreateBody>({
    channelId: mtMap.objectField('channel_id', mtMap.passthrough()),
    emoji: mtMap.objectField(
      'emoji',
      mtMap.union([
        mtMap.unionOption(
          'object',
          mtMap.object({
            type: mtMap.objectField('type', mtMap.passthrough()),
            value: mtMap.objectField('value', mtMap.passthrough()),
            name: mtMap.objectField('name', mtMap.passthrough()),
            url: mtMap.objectField('url', mtMap.passthrough()),
            id: mtMap.objectField('id', mtMap.passthrough())
          })
        ),
        mtMap.unionOption('string', mtMap.passthrough())
      ])
    )
  });

