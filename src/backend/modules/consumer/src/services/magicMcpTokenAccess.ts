import {
  ConsumerGroup,
  ConsumerProfile,
  MagicMcpToken,
  Organization
} from '@metorial/db';
import { consumerAccessPolicyService } from './accessPolicy';

export let grantConsumerOwnedMagicMcpTokenAccess = async (d: {
  organization: Organization;
  consumerProfile: Pick<ConsumerProfile, 'personalConsumerGroupOid'>;
  consumerGroups?: Array<Pick<ConsumerGroup, 'oid' | 'accessTagOid'>>;
  magicMcpToken: Pick<MagicMcpToken, 'oid'>;
}) => {
  for (let permission of ['magic_mcp_read', 'magic_mcp_write'] as const) {
    await consumerAccessPolicyService.grantAccess({
      organization: d.organization,
      permission,
      subject: {
        personalConsumerGroupForProfile: d.consumerProfile
      },
      resource: {
        magicMcpToken: d.magicMcpToken
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
        magicMcpToken: d.magicMcpToken
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
        magicMcpToken: d.magicMcpToken
      }
    });
  }
};
