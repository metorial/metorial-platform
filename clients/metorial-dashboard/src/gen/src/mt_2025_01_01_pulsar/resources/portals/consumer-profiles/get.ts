import { mtMap } from '@metorial/util-resource-mapper';

export type PortalsConsumerProfilesGetOutput = {
  object: 'consumer.profile';
  id: string;
  name: string;
  email: string;
  imageUrl: string;
  groups:
    | {
        object: 'consumer.profile.group_assignment';
        group: {
          object: 'consumer.group';
          id: string;
          status: 'active' | 'inactive';
          name: string;
          description: string | null;
          isDefault: boolean;
          ssoGroupIds: string[];
          createdAt: Date;
          updatedAt: Date;
        };
        assignedVia: 'default' | 'manual' | 'sso';
      }[]
    | null;
  consumerId: string;
  ssoUserId: string | null;
  createdAt: Date;
};

export let mapPortalsConsumerProfilesGetOutput =
  mtMap.object<PortalsConsumerProfilesGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    email: mtMap.objectField('email', mtMap.passthrough()),
    imageUrl: mtMap.objectField('image_url', mtMap.passthrough()),
    groups: mtMap.objectField(
      'groups',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          group: mtMap.objectField(
            'group',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              status: mtMap.objectField('status', mtMap.passthrough()),
              name: mtMap.objectField('name', mtMap.passthrough()),
              description: mtMap.objectField(
                'description',
                mtMap.passthrough()
              ),
              isDefault: mtMap.objectField('is_default', mtMap.passthrough()),
              ssoGroupIds: mtMap.objectField(
                'sso_group_ids',
                mtMap.array(mtMap.passthrough())
              ),
              createdAt: mtMap.objectField('created_at', mtMap.date()),
              updatedAt: mtMap.objectField('updated_at', mtMap.date())
            })
          ),
          assignedVia: mtMap.objectField('assigned_via', mtMap.passthrough())
        })
      )
    ),
    consumerId: mtMap.objectField('consumer_id', mtMap.passthrough()),
    ssoUserId: mtMap.objectField('sso_user_id', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date())
  });

