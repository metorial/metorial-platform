import { Entity, Text, theme } from '@metorial/ui';
import { RiServerLine, RiToolsLine } from '@remixicon/react';
import { CapabilityOverview } from '../components/capabilityOverview';
import { IdentityOverview } from '../components/identityOverview';
import { OverviewStack } from '../styles';
import type { EntityDetail, OverviewSection, TransportMeta } from '../types';
import { asRecord, getMethodParams, getMethodResult } from '../utils';

export let getInitializeOverviewSections = ({
  input,
  output,
  transportMeta
}: {
  input: Record<string, any> | null;
  output: Record<string, any> | null;
  transportMeta: TransportMeta;
}): OverviewSection[] => {
  let params = getMethodParams(input);
  let result = getMethodResult(output);
  let clientInfo = asRecord(params?.clientInfo) ?? transportMeta?.client ?? null;
  let serverInfo = asRecord(result?.serverInfo) ?? transportMeta?.server ?? null;
  let clientCapabilities = asRecord(params?.capabilities);
  let serverCapabilities = asRecord(result?.capabilities);
  let protocolDetails = [
    {
      label: 'Client Version',
      value: params?.protocolVersion ? String(params.protocolVersion) : 'Unknown'
    },
    {
      label: 'Negotiated Version',
      value: result?.protocolVersion ? String(result.protocolVersion) : 'Unknown'
    }
  ] satisfies EntityDetail[];

  return [
    {
      id: 'initialization-details',
      label: 'Initialization',
      content: (
        <OverviewStack>
          <Entity.Wrapper style={{ background: theme.colors.background }}>
            <Entity.Content>
              {protocolDetails.map(detail => (
                <Entity.Field key={detail.label} title={detail.label} value={detail.value} />
              ))}
            </Entity.Content>
          </Entity.Wrapper>

          <IdentityOverview fallbackTitle="Client" icon={<RiToolsLine />} info={clientInfo} />
          <IdentityOverview fallbackTitle="Server" icon={<RiServerLine />} info={serverInfo} />
        </OverviewStack>
      )
    },
    {
      id: 'client-capabilities',
      label: 'Client Capabilities',
      content: <CapabilityOverview capabilities={clientCapabilities} />
    },
    {
      id: 'server-capabilities',
      label: 'Server Capabilities',
      content: <CapabilityOverview capabilities={serverCapabilities} />
    },
    ...(result?.instructions
      ? [
          {
            id: 'instructions',
            label: 'Server Instructions',
            content: (
              <Text size="1" color="gray800">
                {String(result.instructions)}
              </Text>
            )
          }
        ]
      : [])
  ];
};
