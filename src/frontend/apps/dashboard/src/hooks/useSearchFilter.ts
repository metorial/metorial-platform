import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDebounced } from './useDebounced';

export let useSearchFilter = (delay = 500, paramKey = 'search', persistToUrl = true) => {
  let [searchParams, setSearchParams] = useSearchParams();
  let [localSearch, setLocalSearch] = useState('');
  let search = persistToUrl ? (searchParams.get(paramKey) ?? '') : localSearch;
  let searchDebounced = useDebounced(search, delay);
  let searchQuery = searchDebounced.trim() || undefined;

  let setSearch = (value: string) => {
    if (!persistToUrl) {
      setLocalSearch(value);
      return;
    }

    setSearchParams(
      current => {
        let next = new URLSearchParams(current);

        if (value.length > 0) next.set(paramKey, value);
        else next.delete(paramKey);

        return next;
      },
      { replace: true }
    );
  };

  return {
    search,
    setSearch,
    searchQuery
  };
};
