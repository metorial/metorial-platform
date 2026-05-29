import { shadowId } from '@lowerdeck/shadow-id';
import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { networkType } from '../../types';

let ip = process.env.METORIAL_DEFLECTOR_PUBLIC_IP ?? '1.1.1.1';
let region = process.env.METORIAL_REGION ?? 'LO1';

export let v1NetworkPresenter = Presenter.create(networkType)
  .presenter(async ({ network }) => ({
    object: 'network' as const,
    id: network.id,
    name: network.name,
    description: network.description,
    created_at: network.createdAt,
    updated_at: network.updatedAt,
    public_ips: [
      {
        object: 'network.public_ip' as const,
        id: shadowId('ntip_', [network.id, ip]),
        ip,
        region,
        created_at: network.createdAt,
        updated_at: network.createdAt
      }
    ]
  }))
  .schema(
    v.object({
      object: v.literal('network'),
      id: v.string(),
      name: v.string(),
      description: v.nullable(v.string()),
      created_at: v.date(),
      updated_at: v.date(),
      public_ips: v.array(
        v.object({
          object: v.literal('network.public_ip'),
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
