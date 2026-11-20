import { Text } from '@metorial/ui';
import { formatCost } from './costFormat';

export let CostValue = ({ cost }: { cost: { total: string | null; isEstimate: boolean } }) => {
  let formatted = formatCost(cost.total, { estimate: cost.isEstimate });

  if (formatted === null) {
    return (
      <Text as="span" size="2" color="gray600">
        No Cost Data
      </Text>
    );
  }

  return <span>{formatted}</span>;
};
