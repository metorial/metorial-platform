import { Checkbox, Text } from '@metorial/ui';
import { CapabilityList } from '../styles';
import { describeCapability } from '../utils';

export let CapabilityOverview = ({
  capabilities
}: {
  capabilities: Record<string, any> | null | undefined;
}) => {
  let items = Object.entries(capabilities ?? {}).map(([label, value]) => ({
    description: describeCapability(value),
    label
  }));

  if (items.length === 0) {
    return (
      <Text size="1" color="gray700">
        No capabilities declared.
      </Text>
    );
  }

  return (
    <CapabilityList>
      {items.map(item => (
        <Checkbox
          key={item.label}
          checked
          label={item.label}
          description={item.description}
          readOnly
        />
      ))}
    </CapabilityList>
  );
};
