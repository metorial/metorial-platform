import {
  ConsumerGroup,
  ConsumerProfile,
  ConsumerSurface,
  MagicMcpServer,
  Organization
} from '@metorial/db';
import { consumerAccessService } from '../services/consumerAccess';
import { consumerIntegrationService } from '../services/consumerIntegration';

export let grantConsumerOwnedMagicMcpServerAccess = async (d: {
  organization: Organization;
  consumerProfile: Pick<ConsumerProfile, 'oid' | 'instanceOid' | 'consumerOid'> & {
    surface: ConsumerSurface;
    personalConsumerGroup: ConsumerGroup;
  };
  magicMcpServer: MagicMcpServer;
}) => {
  await consumerAccessService.createConsumerAccess({
    organization: d.organization,
    consumerSurface: d.consumerProfile.surface,
    consumerGroup: d.consumerProfile.personalConsumerGroup,
    access: {
      type: 'magic_mcp_server',
      magicMcpServer: d.magicMcpServer
    }
  });

  await consumerIntegrationService.upsertConsumerIntegration({
    consumerProfile: d.consumerProfile,
    magicMcpServer: d.magicMcpServer,
    isManaged: false
  });
};
