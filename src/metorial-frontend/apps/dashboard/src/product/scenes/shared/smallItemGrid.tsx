import { Text, theme } from '@metorial/ui';
import styled from 'styled-components';

type SmallItem = {
  id: string;
  label: string;
  onSelect: () => void;
};

type SmallItemGridProps = {
  items: SmallItem[];
  emptyText?: string;
};

let Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 8px;
  max-height: 300px;
  overflow-y: auto;
`;

let GridButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px 12px;
  border: 1px solid ${theme.colors.gray300};
  border-radius: 8px;
  background: none;
  cursor: pointer;
  text-align: center;
  transition:
    border-color 0.15s,
    background 0.15s;

  &:hover {
    border-color: ${theme.colors.gray500};
    background: ${theme.colors.gray100};
  }
`;

export let SmallItemGrid = ({ items, emptyText }: SmallItemGridProps) => {
  if (items.length === 0 && emptyText) {
    return (
      <Text size="2" color="gray600">
        {emptyText}
      </Text>
    );
  }

  return (
    <Grid>
      {items.map(item => (
        <GridButton key={item.id} type="button" onClick={item.onSelect}>
          <Text size="2">{item.label}</Text>
        </GridButton>
      ))}
    </Grid>
  );
};
