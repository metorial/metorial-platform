import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLocation } from 'react-use';
import {
  TableFilter,
  TableFilterState,
  deserializeFromQuery,
  serializeToQuery
} from '../filter';

export let useFilterQuery = ({
  filters,
  filterState: [filterState, setFilterState]
}: {
  filters?: TableFilter<any>[];
  filterState: [TableFilterState[], React.Dispatch<React.SetStateAction<TableFilterState[]>>];
}) => {
  let location = useLocation();
  let navigate = useNavigate();

  let parsedQueryRef = useRef(false);
  useEffect(() => {
    if (parsedQueryRef.current) return;
    parsedQueryRef.current = true;

    try {
      let query = new URLSearchParams(location.search);
      let filterValues = deserializeFromQuery(query, filters || []);
      setFilterState(filterValues);
    } catch (e) {
      console.error(e);
    }
  }, []);

  let lastSetQueryRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    try {
      let query = serializeToQuery(filterState);
      if (lastSetQueryRef.current == query) return;
      lastSetQueryRef.current = query;

      navigate({ search: query }, { preventScrollReset: true, replace: true });
    } catch (e) {
      console.error(e);
    }
  }, [filterState]);
};
