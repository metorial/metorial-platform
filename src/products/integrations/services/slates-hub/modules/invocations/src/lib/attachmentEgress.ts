import type { SlateInstanceConfiguration } from '@mtsrc/slates-hub-db/client';

export type AttachmentEgress = {
  instanceConfigurationOid?: bigint;
  enclaveId?: string;
  egressPolicy?: SlatesHubPrismaJson.CompiledEgressNetworkAllowList;
};

// A tool call that runs under its session's instance configuration links it, so later firewall
// changes apply to the attachment too. Inline policies have no record to link and are copied.
export let attachmentEgressFor = (d: {
  instanceConfiguration?: SlateInstanceConfiguration | null;
  inline?: {
    enclaveId?: string;
    egressPolicy?: SlatesHubPrismaJson.CompiledEgressNetworkAllowList;
  };
}): AttachmentEgress => {
  if (d.inline?.enclaveId || d.inline?.egressPolicy) {
    return {
      enclaveId: d.inline.enclaveId ?? d.instanceConfiguration?.enclaveId,
      egressPolicy:
        d.inline.egressPolicy ??
        (d.instanceConfiguration?.egressPolicy as
          SlatesHubPrismaJson.CompiledEgressNetworkAllowList | undefined)
    };
  }

  if (d.instanceConfiguration) {
    return { instanceConfigurationOid: d.instanceConfiguration.oid };
  }

  return {};
};

export let resolveAttachmentEgress = (attachment: {
  instanceConfiguration?: Pick<
    SlateInstanceConfiguration,
    'enclaveId' | 'egressPolicy'
  > | null;
  enclaveId: string | null;
  egressPolicy: unknown;
}) => {
  if (attachment.instanceConfiguration) {
    return {
      enclaveId: attachment.instanceConfiguration.enclaveId,
      egressPolicy: attachment.instanceConfiguration
        .egressPolicy as SlatesHubPrismaJson.CompiledEgressNetworkAllowList
    };
  }

  return {
    enclaveId: attachment.enclaveId,
    egressPolicy:
      attachment.egressPolicy as SlatesHubPrismaJson.CompiledEgressNetworkAllowList | null
  };
};
