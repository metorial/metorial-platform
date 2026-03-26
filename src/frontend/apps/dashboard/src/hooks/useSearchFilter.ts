import { useSearchParams } from 'react-router-dom';
import { useDebounced } from './useDebounced';

export let useSearchFilter = (delay = 500) => {
  let [searchParams, setSearchParams] = useSearchParams();
  let search = searchParams.get('search') ?? '';
  let searchDebounced = useDebounced(search, delay);
  let searchQuery = searchDebounced.trim() || undefined;

  let setSearch = (value: string) => {
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
