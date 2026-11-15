import { ConsumerGroup, ConsumerProfile, MagicMcpEndpoint, Organization } from '@metorial/db';
import { consumerAccessPolicyService } from '@metorial/module-consumer-access';
import { consumerIntegrationService } from '@metorial/module-consumer-entities';

export let grantConsumerOwnedMagicMcpEndpointAccess = async (d: {
  organization: Organization;
  consumerProfile: Pick<
    ConsumerProfile,
    'oid' | 'instanceOid' | 'consumerOid' | 'personalConsumerGroupOid'
  >;
  consumerGroups?: Array<Pick<ConsumerGroup, 'oid' | 'accessTagOid'>>;
  magicMcpEndpoint: Pick<MagicMcpEndpoint, 'oid' | 'instanceOid'>;
}) => {
  await consumerIntegrationService.upsertConsumerIntegrationEndpoint({
    consumerProfile: d.consumerProfile,
    magicMcpEndpoint: d.magicMcpEndpoint,
    isManaged: false
  });

  for (let permission of ['magic_mcp_read', 'magic_mcp_write'] as const) {
    await consumerAccessPolicyService.grantAccess({
      organization: d.organization,
      permission,
      subject: {
        personalConsumerGroupForProfile: d.consumerProfile
      },
      resource: {
        magicMcpEndpoint: d.magicMcpEndpoint
      }
    });
  }

  let connectGroups = d.consumerGroups?.length
    ? Array.from(new Map(d.consumerGroups.map(group => [group.oid, group])).values())
    : [];

  if (!connectGroups.length) {
    await consumerAccessPolicyService.grantAccess({
      organization: d.organization,
      permission: 'magic_mcp_connect',
      subject: {
        personalConsumerGroupForProfile: d.consumerProfile
      },
      resource: {
        magicMcpEndpoint: d.magicMcpEndpoint
      }
    });

    return;
  }

  for (let consumerGroup of connectGroups) {
    await consumerAccessPolicyService.grantAccess({
      organization: d.organization,
      permission: 'magic_mcp_connect',
      subject: {
        consumerGroup
      },
      resource: {
        magicMcpEndpoint: d.magicMcpEndpoint
      }
    });
  }
};
