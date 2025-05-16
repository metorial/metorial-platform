import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceServersVersionsGetOutput = {
  id: string;
  identifier: string;
  serverId: string;
  serverVariantId: string;
  getLaunchParams: string;
  source:
    | { type: 'docker'; docker: { image: string; tag: string } }
    | { type: 'remote'; remote: { domain: string } };
  config: {
    id: string;
    fingerprint: string;
    schema: Record<string, any>;
    serverId: string;
    serverVariantId: string;
    serverVersionId: string;
    createdAt: Date;
  };
  createdAt: Date;
};

export let mapManagementInstanceServersVersionsGetOutput =
  mtMap.object<ManagementInstanceServersVersionsGetOutput>({
    id: mtMap.objectField('id', mtMap.passthrough()),
    identifier: mtMap.objectField('identifier', mtMap.passthrough()),
    serverId: mtMap.objectField('server_id', mtMap.passthrough()),
    serverVariantId: mtMap.objectField(
      'server_variant_id',
      mtMap.passthrough()
    ),
    getLaunchParams: mtMap.objectField(
      'get_launch_params',
      mtMap.passthrough()
    ),
    source: mtMap.objectField(
      'source',
      mtMap.union([
        mtMap.unionOption(
          'object',
          mtMap.object({
            type: mtMap.objectField('type', mtMap.passthrough()),
            docker: mtMap.objectField(
              'docker',
              mtMap.object({
                image: mtMap.objectField('image', mtMap.passthrough()),
                tag: mtMap.objectField('tag', mtMap.passthrough())
              })
            ),
            remote: mtMap.objectField(
              'remote',
              mtMap.object({
                domain: mtMap.objectField('domain', mtMap.passthrough())
              })
            )
          })
        )
      ])
    ),
    config: mtMap.objectField(
      'config',
      mtMap.object({
        id: mtMap.objectField('id', mtMap.passthrough()),
        fingerprint: mtMap.objectField('fingerprint', mtMap.passthrough()),
        schema: mtMap.objectField('schema', mtMap.passthrough()),
        serverId: mtMap.objectField('server_id', mtMap.passthrough()),
        serverVariantId: mtMap.objectField(
          'server_variant_id',
          mtMap.passthrough()
        ),
        serverVersionId: mtMap.objectField(
          'server_version_id',
          mtMap.passthrough()
        ),
        createdAt: mtMap.objectField('created_at', mtMap.date())
      })
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date())
  });

