import { Text } from '@metorial/ui';
import { formatCost } from './costFormat';

export let CostValue = ({
  cost
}: {
  cost: { totalMicros: number | null; isEstimate: boolean };
}) => {
  let formatted = formatCost(cost.totalMicros, { estimate: cost.isEstimate });

  if (formatted === null) {
    return (
      <Text as="span" size="2" color="gray600">
        No Cost Data
      </Text>
    );
  }

  return <span>{formatted}</span>;
};
