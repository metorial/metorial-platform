import { MagicMcpServer } from '@metorial/db';

export let isPreconfiguredMagicMcpServer = (magicMcpServer: {
  source: MagicMcpServer['source'];
}) => {
  return magicMcpServer.source != 'consumer_provider_template';
};
