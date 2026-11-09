import { ItemGrid } from '@metorial/ui-product';
import React from 'react';
import type { DataListController } from '../controller';

export let DataListGridLayout = ({ controller }: { controller: DataListController }) => {
  let { config, props, ctx, items, getItemProps } = controller;

  return (
    <ItemGrid.Root width={config.gridWidth ?? '300px'}>
      {items.map(row => {
        let view = config.item!(row, props, ctx);
        let itemProps = getItemProps(row);
        let href = view.href === null ? undefined : (view.href ?? itemProps.href);
        let onClick = view.onClick ?? (href ? undefined : itemProps.onClick);

        return (
          <ItemGrid.Item
            key={row.id}
            variant="v2"
            title={view.title}
            description={view.description}
            icon={view.icon}
            bottom={view.footer ?? view.meta}
            entity={{ id: row.id }}
            showCopyId={view.showCopyId ?? true}
            menu={itemProps.menu.map(item => ({ label: item.label, onClick: item.onClick }))}
            height={view.height ?? 220}
            href={href}
            onClick={onClick}
            loading={itemProps.isLoading}
          />
        );
      })}
    </ItemGrid.Root>
  );
};
