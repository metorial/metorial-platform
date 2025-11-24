import { mtMap } from '@metorial/util-resource-mapper';

export type ServersListingsReadmeGetOutput = {
  object: 'server_listing.readme';
  readmeHtml: string | null;
};

export let mapServersListingsReadmeGetOutput =
  mtMap.object<ServersListingsReadmeGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    readmeHtml: mtMap.objectField('readme_html', mtMap.passthrough())
  });

export type ServersListingsReadmeGetQuery = { instanceId?: string | undefined };

export let mapServersListingsReadmeGetQuery =
  mtMap.object<ServersListingsReadmeGetQuery>({
    instanceId: mtMap.objectField('instance_id', mtMap.passthrough())
  });

