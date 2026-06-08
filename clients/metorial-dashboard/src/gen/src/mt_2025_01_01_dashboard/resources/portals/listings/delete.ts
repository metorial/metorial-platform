import { mtMap } from '@metorial/util-resource-mapper';

export type PortalsListingsDeleteOutput = {
  object: 'consumer.access_listing';
  id: string;
  name: string;
  description: string | null;
  readme: string | null;
  access:
    | {
        type: 'provider_template';
        providerTemplate: {
          object: 'provider.template#preview';
          id: string;
          status: 'active' | 'archived' | 'deleted';
          name: string;
          description: string | null;
          metadata: Record<string, any>;
          integrationId: string | null;
          createdAt: Date;
          updatedAt: Date;
        };
      }
    | {
        type: 'magic_mcp_server';
        magicMcpServer: {
          object: 'magic_mcp.server#preview';
          id: string;
          status: 'active' | 'archived' | 'deleted';
          name: string | null;
          description: string | null;
        };
      }
    | {
        type: 'skill';
        skill: {
          object: 'skill';
          id: string;
          status: 'active' | 'archived' | 'deleted';
          name: string;
        };
      }
    | {
        type: 'skill_template';
        skillTemplate: {
          object: 'skill.template';
          id: string;
          status: 'active' | 'archived' | 'deleted';
          owner: 'system' | 'tenant';
          name: string;
          description: string | null;
        };
      }
    | {
        type: 'skill_group';
        skillGroup: {
          object: 'skill.group';
          id: string;
          status: 'active' | 'archived' | 'deleted';
          name: string;
          description: string | null;
        };
      }
    | {
        type: 'skill_marketplace';
        skillMarketplace: {
          object: 'skill.marketplace';
          id: string;
          status: 'active' | 'archived' | 'deleted';
        };
      };
  groups: {
    id: string;
    name: string;
    description: string | null;
    index: number;
  }[];
  createdAt: Date;
  updatedAt: Date;
};

export let mapPortalsListingsDeleteOutput =
  mtMap.object<PortalsListingsDeleteOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    readme: mtMap.objectField('readme', mtMap.passthrough()),
    access: mtMap.objectField(
      'access',
      mtMap.union([
        mtMap.unionOption(
          'object',
          mtMap.object({
            type: mtMap.objectField('type', mtMap.passthrough()),
            providerTemplate: mtMap.objectField(
              'provider_template',
              mtMap.object({
                object: mtMap.objectField('object', mtMap.passthrough()),
                id: mtMap.objectField('id', mtMap.passthrough()),
                status: mtMap.objectField('status', mtMap.passthrough()),
                name: mtMap.objectField('name', mtMap.passthrough()),
                description: mtMap.objectField(
                  'description',
                  mtMap.passthrough()
                ),
                metadata: mtMap.objectField('metadata', mtMap.passthrough()),
                integrationId: mtMap.objectField(
                  'integration_id',
                  mtMap.passthrough()
                ),
                createdAt: mtMap.objectField('created_at', mtMap.date()),
                updatedAt: mtMap.objectField('updated_at', mtMap.date())
              })
            ),
            magicMcpServer: mtMap.objectField(
              'magic_mcp_server',
              mtMap.object({
                object: mtMap.objectField('object', mtMap.passthrough()),
                id: mtMap.objectField('id', mtMap.passthrough()),
                status: mtMap.objectField('status', mtMap.passthrough()),
                name: mtMap.objectField('name', mtMap.passthrough()),
                description: mtMap.objectField(
                  'description',
                  mtMap.passthrough()
                )
              })
            ),
            skill: mtMap.objectField(
              'skill',
              mtMap.object({
                object: mtMap.objectField('object', mtMap.passthrough()),
                id: mtMap.objectField('id', mtMap.passthrough()),
                status: mtMap.objectField('status', mtMap.passthrough()),
                name: mtMap.objectField('name', mtMap.passthrough())
              })
            ),
            skillTemplate: mtMap.objectField(
              'skill_template',
              mtMap.object({
                object: mtMap.objectField('object', mtMap.passthrough()),
                id: mtMap.objectField('id', mtMap.passthrough()),
                status: mtMap.objectField('status', mtMap.passthrough()),
                owner: mtMap.objectField('owner', mtMap.passthrough()),
                name: mtMap.objectField('name', mtMap.passthrough()),
                description: mtMap.objectField(
                  'description',
                  mtMap.passthrough()
                )
              })
            ),
            skillGroup: mtMap.objectField(
              'skill_group',
              mtMap.object({
                object: mtMap.objectField('object', mtMap.passthrough()),
                id: mtMap.objectField('id', mtMap.passthrough()),
                status: mtMap.objectField('status', mtMap.passthrough()),
                name: mtMap.objectField('name', mtMap.passthrough()),
                description: mtMap.objectField(
                  'description',
                  mtMap.passthrough()
                )
              })
            ),
            skillMarketplace: mtMap.objectField(
              'skill_marketplace',
              mtMap.object({
                object: mtMap.objectField('object', mtMap.passthrough()),
                id: mtMap.objectField('id', mtMap.passthrough()),
                status: mtMap.objectField('status', mtMap.passthrough())
              })
            )
          })
        )
      ])
    ),
    groups: mtMap.objectField(
      'groups',
      mtMap.array(
        mtMap.object({
          id: mtMap.objectField('id', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          description: mtMap.objectField('description', mtMap.passthrough()),
          index: mtMap.objectField('index', mtMap.passthrough())
        })
      )
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

