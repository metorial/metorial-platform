import { Entity, Text, theme } from '@metorial/ui';
import { RiFileTextLine } from '@remixicon/react';
import { EmbeddedResourceView } from '../components/embeddedResourceView';
import { BlockStack, OverviewEntityIcon } from '../styles';
import type { OverviewSection } from '../types';
import { asRecord, getMethodParams, getMethodResult } from '../utils';

export let getResourceReadOverviewSections = ({
  input,
  output
}: {
  input: Record<string, any> | null;
  output: Record<string, any> | null;
}): OverviewSection[] => {
  let params = getMethodParams(input);
  let result = getMethodResult(output);
  let uri = params?.uri ? String(params.uri) : null;
  let contents = Array.isArray(result?.contents) ? result.contents : [];

  return [
    {
      id: 'resource-request',
      label: 'Request',
      content: (
        <Entity.Wrapper style={{ background: theme.colors.background }}>
          <Entity.Content>
            <Entity.Field
              title={uri ?? 'Unknown URI'}
              prefix={
                <OverviewEntityIcon>
                  <RiFileTextLine />
                </OverviewEntityIcon>
              }
            />
          </Entity.Content>
        </Entity.Wrapper>
      )
    },
    {
      id: 'resource-contents',
      label: 'Contents',
      content:
        contents.length === 0 ? (
          <Text size="1" color="gray700">
            No contents returned.
          </Text>
        ) : (
          <BlockStack>
            {contents.map((resource: any, index: number) => (
              <EmbeddedResourceView key={index} resource={asRecord(resource)} />
            ))}
          </BlockStack>
        )
    }
  ];
};
