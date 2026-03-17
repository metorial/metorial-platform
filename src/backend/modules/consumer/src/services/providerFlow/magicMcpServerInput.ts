import type { MagicMcpServerSource } from '@metorial/db';

export let buildConsumerMagicMcpServerCreateInput = (d: {
  name?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  providerName: string;
  providerDescription?: string | null;
  providerTemplateDescription?: string | null;
  providerDeploymentDescription?: string | null;
  providerTemplateId: string;
}): {
  source: MagicMcpServerSource;
  providerTemplateId: string;
  name: string;
  description?: string;
  metadata: Record<string, unknown>;
} => {
  return {
    source: 'consumer_provider_template',
    providerTemplateId: d.providerTemplateId,
    name: d.name ?? d.providerName,
    description:
      d.description ??
      d.providerTemplateDescription ??
      d.providerDeploymentDescription ??
      d.providerDescription ??
      undefined,
    metadata: d.metadata ?? {}
  };
};
