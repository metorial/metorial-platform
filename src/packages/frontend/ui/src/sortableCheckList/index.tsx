import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { RiDraggable } from '@remixicon/react';
import React, { useEffect, useState } from 'react';
import { styled } from 'styled-components';
import { theme } from '..';
import { Checkbox } from '../checkbox';

let List = styled('ul')`
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
`;

let ListItem = styled('li')`
  padding: 5px 0px;
  display: flex;
  gap: 10px;
  align-items: center;
  width: 100%;
`;

export let SortableCheckList = ({
  items,
  onChange,
  syncItems,
  sortable = true
}: {
  items: {
    id: string;
    label: React.ReactNode;
    isChecked: boolean;
  }[];
  onChange: (items: { id: string; label: React.ReactNode; isChecked: boolean }[]) => void;
  syncItems?: boolean;
  sortable?: boolean;
}) => {
  let [innerItems, setInnerItems] = useState(() => items);

  let sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  let setItems = (items: { id: string; label: React.ReactNode; isChecked: boolean }[]) => {
    setInnerItems(items);
    onChange(items);
  };

  useEffect(() => {
    if (syncItems && items != innerItems) {
      setInnerItems(items);
    } else if (!syncItems) {
      let newIDs = new Set(items.map(i => i.id));
      let currentIDs = new Set(innerItems.map(i => i.id));

      if (newIDs.size !== currentIDs.size || [...newIDs].some(id => !currentIDs.has(id))) {
        setInnerItems(items);
      }
    }
  }, [items, syncItems]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={event => {
        let { active, over } = event;

        if (active && over && active.id !== over.id) {
          let oldIndex = innerItems.findIndex(item => item.id === active.id);
          let newIndex = innerItems.findIndex(item => item.id === over!.id);

          setItems(arrayMove(innerItems, oldIndex, newIndex));
        }
      }}
    >
      <SortableContext items={innerItems} strategy={verticalListSortingStrategy}>
        <List>
          {innerItems.map((item, i) => (
            <SortableItem
              key={`${item.id}-${i}`}
              id={item.id}
              item={item}
              sortable={sortable}
              onCheckedChange={() => {
                setItems(
                  innerItems.map(i => {
                    if (i.id === item.id) {
                      return { ...i, isChecked: !i.isChecked };
                    }

                    return i;
                  })
                );
              }}
            />
          ))}
        </List>
      </SortableContext>
    </DndContext>
  );
};

let SortableItem = ({
  id,
  item,
  sortable,
  onCheckedChange
}: {
  id: string;
  item: { id: string; label: React.ReactNode; isChecked: boolean };
  onCheckedChange: (value: boolean) => void;
  sortable: boolean;
}) => {
  let { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });

  let style = {
    transform: CSS.Transform.toString(transform),
    transition
  };

  return (
    <ListItem data-dnd-id={id} ref={setNodeRef} style={style}>
      {sortable && (
        <div
          {...attributes}
          {...listeners}
          style={{ display: 'flex', alignItems: 'center', cursor: 'grab' }}
        >
          <RiDraggable size={16} color={String(theme.colors.gray600)} />
        </div>
      )}

      <Checkbox
        label={item.label}
        checked={item.isChecked}
        onCheckedChange={onCheckedChange}
      />
    </ListItem>
  );
};
