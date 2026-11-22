import { shadowId } from '@lowerdeck/shadow-id';
import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { integrationInternetGatewayType } from '../../types';

let ip = process.env.METORIAL_DEFLECTOR_PUBLIC_IP ?? '1.1.1.1';
let region = process.env.METORIAL_REGION ?? 'LO1';
let maskedPublicIp = 'x.x.x.x';

export let v1IntegrationInternetGatewayPresenter = Presenter.create(
  integrationInternetGatewayType
)
  .presenter(async ({ internetGateway, maskPublicIp }) => {
    let displayedIp = maskPublicIp ? maskedPublicIp : ip;

    return {
      object: 'integration.internet_gateway' as const,
      id: internetGateway.id,
      name: internetGateway.name,
      description: internetGateway.description,
      created_at: internetGateway.createdAt,
      updated_at: internetGateway.updatedAt,
      public_ips: [
        {
          object: 'integration.internet_gateway.public_ip' as const,
          id: shadowId('ntip_', [internetGateway.id, displayedIp]),
          ip: displayedIp,
          region,
          created_at: internetGateway.createdAt,
          updated_at: internetGateway.createdAt
        }
      ]
    };
  })
  .schema(
    v.object({
      object: v.literal('integration.internet_gateway', {
        description: 'String representing the object’s type.'
      }),
      id: v.string({
        description: 'Unique ID.'
      }),
      name: v.string({
        description: 'Display name.'
      }),
      description: v.nullable(
        v.string({
          description: 'Free-text description.'
        })
      ),
      created_at: v.date({
        description: 'Creation time.'
      }),
      updated_at: v.date({
        description: 'Last update time.'
      }),
      public_ips: v.array(
        v.object({
          object: v.literal('integration.internet_gateway.public_ip', {
            description: 'String representing the object’s type.'
          }),
          id: v.string({
            description: 'Unique ID.'
          }),
          ip: v.string({
            description:
              'Public IP address. Masked as `x.x.x.x` unless your plan includes IP access.'
          }),
          region: v.string({
            description: 'Region the IP belongs to.'
          }),
          created_at: v.date({
            description: 'Creation time.'
          }),
          updated_at: v.date({
            description: 'Creation time.'
          })
        }),
        {
          description:
            'Public IPs of the gateway. Masked as `x.x.x.x` unless your plan includes IP access.'
        }
      )
    })
  )
  .build();
