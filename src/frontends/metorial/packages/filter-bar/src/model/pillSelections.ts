import { useCallback, useEffect, useMemo, useState } from 'react';
import { getListValue } from './state';
import type { TableFilterState } from './tableFilter';

type PillIds = Record<string, string[]>;

export type PillSelections = {
  ids: PillIds;
  mark: (filterId: string, valueId: string, selected: boolean) => void;
  clear: (filterId: string) => void;
};

export let usePillSelections = (filterState: TableFilterState[]): PillSelections => {
  let [ids, setIds] = useState<PillIds>({});

  useEffect(() => {
    setIds(prev => {
      let changed = false;
      let next: PillIds = {};

      for (let [filterId, valueIds] of Object.entries(prev)) {
        let current = getListValue(filterState.find(f => f.id == filterId));
        let kept = valueIds.filter(id => current.includes(id));
        if (kept.length != valueIds.length) changed = true;
        if (kept.length) next[filterId] = kept;
        else changed = true;
      }

      return changed ? next : prev;
    });
  }, [filterState]);

  let mark = useCallback((filterId: string, valueId: string, selected: boolean) => {
    setIds(prev => {
      let current = prev[filterId] ?? [];
      if (selected == current.includes(valueId)) return prev;

      let value = selected ? [...current, valueId] : current.filter(id => id != valueId);
      return { ...prev, [filterId]: value };
    });
  }, []);

  let clear = useCallback((filterId: string) => {
    setIds(prev => {
      if (!prev[filterId]) return prev;
      let { [filterId]: _removed, ...rest } = prev;
      return rest;
    });
  }, []);

  return useMemo(() => ({ ids, mark, clear }), [ids, mark, clear]);
};
