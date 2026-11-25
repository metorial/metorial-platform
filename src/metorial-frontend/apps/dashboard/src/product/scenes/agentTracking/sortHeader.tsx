import { theme } from '@metorial/ui';
import { RiArrowDownLine, RiArrowUpDownLine, RiArrowUpLine } from '@remixicon/react';
import { styled } from 'styled-components';
import { WithInfo } from './info';

let SortButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  color: inherit;
  text-align: left;
  white-space: nowrap;
  cursor: pointer;

  &:hover,
  &:focus-visible {
    color: ${theme.colors.foreground};
  }
`;

export let SortHeader = ({
  label,
  name = label,
  info,
  active,
  ascending,
  onToggle
}: {
  label: string;
  name?: string;
  info?: string | null;
  active: boolean;
  ascending: boolean;
  onToggle: () => void;
}) => {
  let Icon = !active ? RiArrowUpDownLine : ascending ? RiArrowUpLine : RiArrowDownLine;

  return (
    <WithInfo info={info}>
      <SortButton
        type="button"
        title={`Sort by ${name}`}
        aria-label={
          active ? `${name}, sorted ${ascending ? 'ascending' : 'descending'}` : name
        }
        onClick={onToggle}
      >
        {label}
        <Icon size={12} color={active ? undefined : theme.colors.gray650} aria-hidden />
      </SortButton>
    </WithInfo>
  );
};
