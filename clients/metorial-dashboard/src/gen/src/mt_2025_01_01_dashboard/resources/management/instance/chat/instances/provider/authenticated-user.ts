import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceChatInstancesProviderAuthenticatedUserOutput = {
  object: 'chat.authenticated_user';
  id: string | null;
  chatId: string | null;
  type: 'user' | 'app' | 'system' | 'webhook' | 'unknown';
  role: 'member' | 'guest' | 'unknown';
  providerType: string | null;
  providerAuthorId: string;
  userName: string;
  fullName: string;
  email: string | null;
  imageUrl: string | null;
  isSelf: boolean;
  workspace: {
    id: string;
    providerWorkspaceId: string;
    name: string | null;
    domain: string | null;
    imageUrl: string | null;
  } | null;
};

export let mapManagementInstanceChatInstancesProviderAuthenticatedUserOutput =
  mtMap.object<ManagementInstanceChatInstancesProviderAuthenticatedUserOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    chatId: mtMap.objectField('chat_id', mtMap.passthrough()),
    type: mtMap.objectField('type', mtMap.passthrough()),
    role: mtMap.objectField('role', mtMap.passthrough()),
    providerType: mtMap.objectField('provider_type', mtMap.passthrough()),
    providerAuthorId: mtMap.objectField(
      'provider_author_id',
      mtMap.passthrough()
    ),
    userName: mtMap.objectField('user_name', mtMap.passthrough()),
    fullName: mtMap.objectField('full_name', mtMap.passthrough()),
    email: mtMap.objectField('email', mtMap.passthrough()),
    imageUrl: mtMap.objectField('image_url', mtMap.passthrough()),
    isSelf: mtMap.objectField('is_self', mtMap.passthrough()),
    workspace: mtMap.objectField(
      'workspace',
      mtMap.object({
        id: mtMap.objectField('id', mtMap.passthrough()),
        providerWorkspaceId: mtMap.objectField(
          'provider_workspace_id',
          mtMap.passthrough()
        ),
        name: mtMap.objectField('name', mtMap.passthrough()),
        domain: mtMap.objectField('domain', mtMap.passthrough()),
        imageUrl: mtMap.objectField('image_url', mtMap.passthrough())
      })
    )
  });

