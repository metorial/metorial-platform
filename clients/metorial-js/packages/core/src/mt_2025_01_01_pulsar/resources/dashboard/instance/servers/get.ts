import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceServersGetOutput = {
  id: string;
  type: 'public';
  name: string;
  description: string | null;
  importedServerId: string | null;
  variants: {
    id: string;
    identifier: string;
    serverId: string;
    currentVersion: {
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
        config: Record<string, any>;
        serverId: string;
        serverVariantId: string;
        serverVersionId: string;
        createdAt: Date;
      };
      createdAt: Date;
    } | null;
    source:
      | { type: 'docker'; docker: { image: string } }
      | { type: 'remote'; remote: { domain: string } };
    createdAt: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstanceServersGetOutput =
  mtMap.object<DashboardInstanceServersGetOutput>({
    id: mtMap.objectField('id', mtMap.passthrough()),
    type: mtMap.objectField('type', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    importedServerId: mtMap.objectField(
      'imported_server_id',
      mtMap.passthrough()
    ),
    variants: mtMap.objectField(
      'variants',
      mtMap.array(
        mtMap.object({
          id: mtMap.objectField('id', mtMap.passthrough()),
          identifier: mtMap.objectField('identifier', mtMap.passthrough()),
          serverId: mtMap.objectField('server_id', mtMap.passthrough()),
          currentVersion: mtMap.objectField(
            'current_version',
            mtMap.object({
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
                          image: mtMap.objectField(
                            'image',
                            mtMap.passthrough()
                          ),
                          tag: mtMap.objectField('tag', mtMap.passthrough())
                        })
                      ),
                      remote: mtMap.objectField(
                        'remote',
                        mtMap.object({
                          domain: mtMap.objectField(
                            'domain',
                            mtMap.passthrough()
                          )
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
                  fingerprint: mtMap.objectField(
                    'fingerprint',
                    mtMap.passthrough()
                  ),
                  config: mtMap.objectField('config', mtMap.passthrough()),
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
            })
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
                      image: mtMap.objectField('image', mtMap.passthrough())
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
          createdAt: mtMap.objectField('created_at', mtMap.date())
        })
      )
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

