import { mtMap } from '@metorial/util-resource-mapper';

export type IntegrationInternetGatewayGetOutput = {
  object: 'integration.internet_gateway';
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  publicIps: {
    object: 'integration.internet_gateway.public_ip';
    id: string;
    ip: string;
    region: string;
    createdAt: Date;
    updatedAt: Date;
  }[];
};

export let mapIntegrationInternetGatewayGetOutput =
  mtMap.object<IntegrationInternetGatewayGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date()),
    publicIps: mtMap.objectField(
      'public_ips',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          ip: mtMap.objectField('ip', mtMap.passthrough()),
          region: mtMap.objectField('region', mtMap.passthrough()),
          createdAt: mtMap.objectField('created_at', mtMap.date()),
          updatedAt: mtMap.objectField('updated_at', mtMap.date())
        })
      )
    )
  });

