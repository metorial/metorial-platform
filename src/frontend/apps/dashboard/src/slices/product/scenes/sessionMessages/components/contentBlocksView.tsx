import { Text } from '@metorial/ui';
import { BlockStack } from '../styles';
import { ContentBlockView } from './contentBlockView';

export let ContentBlocksView = ({ content }: { content: unknown }) => {
  if (!Array.isArray(content) || content.length === 0) {
    return (
      <Text size="1" color="gray700">
        No content returned.
      </Text>
    );
  }

  return (
    <BlockStack>
      {content.map((block, index) => (
        <ContentBlockView key={index} content={block} index={index} />
      ))}
    </BlockStack>
  );
};
