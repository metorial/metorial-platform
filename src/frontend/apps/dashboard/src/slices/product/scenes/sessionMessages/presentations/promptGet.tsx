import { Text } from '@metorial/ui';
import { ArgumentsView } from '../components/argumentsView';
import { PromptMessageView } from '../components/promptMessageView';
import { BlockStack } from '../styles';
import type { OverviewSection } from '../types';
import { asRecord, getMethodParams, getMethodResult } from '../utils';

export let getPromptGetOverviewSections = ({
  input,
  output
}: {
  input: Record<string, any> | null;
  output: Record<string, any> | null;
}): OverviewSection[] => {
  let params = getMethodParams(input);
  let result = getMethodResult(output);
  let args = asRecord(params?.arguments);
  let description = result?.description ? String(result.description) : null;
  let messages = Array.isArray(result?.messages) ? result.messages : [];

  let sections: OverviewSection[] = [
    {
      id: 'prompt-arguments',
      label: 'Arguments',
      content: <ArgumentsView args={args} />
    }
  ];

  if (description) {
    sections.push({
      id: 'prompt-description',
      label: 'Description',
      content: (
        <Text size="1" color="gray800">
          {description}
        </Text>
      )
    });
  }

  sections.push({
    id: 'prompt-messages',
    label: 'Messages',
    content:
      messages.length === 0 ? (
        <Text size="1" color="gray700">
          No messages returned.
        </Text>
      ) : (
        <BlockStack>
          {messages.map((message, index) => (
            <PromptMessageView key={index} message={message} />
          ))}
        </BlockStack>
      )
  });

  return sections;
};
