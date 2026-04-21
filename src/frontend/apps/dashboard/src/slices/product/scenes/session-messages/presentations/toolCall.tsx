import { CodeBlock } from '@metorial/code';
import { Text } from '@metorial/ui';
import { RiErrorWarningLine } from '@remixicon/react';
import { ArgumentsView } from '../components/argumentsView';
import { ContentBlocksView } from '../components/contentBlocksView';
import { BlockStack, StatusBadge } from '../styles';
import type { OverviewSection } from '../types';
import { asRecord, formatRawJson, getMethodParams, getMethodResult } from '../utils';

export let getToolCallOverviewSections = ({
  input,
  output
}: {
  input: Record<string, any> | null;
  output: Record<string, any> | null;
}): OverviewSection[] => {
  let params = getMethodParams(input);
  let result = getMethodResult(output);
  let args = asRecord(params?.arguments);
  let isError = result?.isError === true;
  let structuredContent = asRecord(result?.structuredContent);
  let content = result?.content;
  let hasContent = Array.isArray(content) && content.length > 0;

  let sections: OverviewSection[] = [
    {
      id: 'tool-arguments',
      label: 'Arguments',
      content: <ArgumentsView args={args} />
    }
  ];

  if (result || output) {
    sections.push({
      id: 'tool-result',
      label: 'Result',
      content: (
        <BlockStack>
          {isError ? (
            <div>
              <StatusBadge data-variant="error">
                <RiErrorWarningLine size={12} />
                Tool reported an error
              </StatusBadge>
            </div>
          ) : null}
          {structuredContent ? (
            <CodeBlock
              language="json"
              variant="bordered"
              code={formatRawJson(structuredContent)}
            />
          ) : hasContent ? (
            <ContentBlocksView content={content} />
          ) : (
            <Text size="1" color="gray700">
              No content returned.
            </Text>
          )}
        </BlockStack>
      )
    });
  }

  return sections;
};
