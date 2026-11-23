import { Text } from '@metorial/ui';

export let UnmatchedModelNames = ({ names }: { names: string[] }) => {
  let joined = names.join(', ');

  return (
    <div title={joined} style={{ minWidth: 0, maxWidth: 240 }}>
      <Text as="div" size="1" color="gray600" truncate>
        {joined}
      </Text>
    </div>
  );
};
