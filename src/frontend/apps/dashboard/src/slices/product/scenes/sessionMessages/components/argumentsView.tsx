import { Text } from '@metorial/ui';
import { JsonViewer } from '../../../../../components/jsonViewer';

export let ArgumentsView = ({ args }: { args: Record<string, any> | null | undefined }) => {
  if (!args || Object.keys(args).length === 0) {
    return (
      <Text size="1" color="gray700">
        No arguments provided.
      </Text>
    );
  }

  return <JsonViewer value={args} />;
};
