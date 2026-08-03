import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDebounced } from '@metorial/use-debounced';

export let useSearchFilter = (
  delay = 500,
  opts: {
    updateSearchParams?: boolean;
  } = {}
) => {
  let updateSearchParams = opts.updateSearchParams ?? true;
  let [localSearch, setLocalSearch] = useState('');
  let [searchParams, setSearchParams] = useSearchParams();
  let search = updateSearchParams ? (searchParams.get('search') ?? '') : localSearch;
  let searchDebounced = useDebounced(search, delay);
  let searchQuery = searchDebounced.trim() || undefined;

  let setSearch = (value: string) => {
    if (!updateSearchParams) {
      setLocalSearch(value);
      return;
    }

    setSearchParams(
      current => {
        let next = new URLSearchParams(current);

        if (value.length > 0) next.set('search', value);
        else next.delete('search');

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
