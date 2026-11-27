import { Text } from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import type { ReactNode } from 'react';
import { OverviewHint, OverviewStack } from '../styles';

export let CatalogTable = ({
  emptyText,
  headers,
  moreText,
  rows
}: {
  emptyText: string;
  headers: string[];
  moreText?: string | null;
  rows: ReactNode[][];
}) => {
  if (rows.length === 0) {
    return (
      <Text size="1" color="gray700">
        {emptyText}
      </Text>
    );
  }

  return (
    <OverviewStack>
      <Table headers={headers} data={rows} />

      {moreText ? <OverviewHint>{moreText}</OverviewHint> : null}
    </OverviewStack>
  );
};
