import { OptionToggle } from '@metorial/ui';
import { RiLayoutGridLine, RiListUnordered, RiTableView } from '@remixicon/react';
import React from 'react';
import type { DataListLayoutOption } from '../controller';

let icons: Record<string, React.ReactNode> = {
  table: <RiTableView size={15} />,
  grid: <RiLayoutGridLine size={15} />,
  list: <RiListUnordered size={15} />
};

export let DataListLayoutSwitcher = ({
  options,
  value,
  onChange
}: {
  options: DataListLayoutOption[];
  value: string;
  onChange: (id: string) => void;
}) => {
  if (options.length < 2) return null;

  return (
    <OptionToggle
      label="Layout"
      hideLabel
      itemMinWidth={38}
      value={value}
      onChange={onChange}
      items={options.map(option => ({
        id: option.id,
        label: option.custom?.icon ?? icons[option.id] ?? option.label,
        tooltip: option.label
      }))}
    />
  );
};
