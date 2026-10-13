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
      object: v.literal('integration.internet_gateway'),
      id: v.string(),
      name: v.string(),
      description: v.nullable(v.string()),
      created_at: v.date(),
      updated_at: v.date(),
      public_ips: v.array(
        v.object({
          object: v.literal('integration.internet_gateway.public_ip'),
          id: v.string(),
          ip: v.string(),
          region: v.string(),
          created_at: v.date(),
          updated_at: v.date()
        })
      )
    })
  )
  .build();
