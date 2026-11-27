import { debounce } from 'lodash';
import { useEffect, useMemo, useState } from 'react';

export let useDebounced = <T>(value: T, delay: number): T => {
  let [debouncedValue, setDebouncedValue] = useState(() => value);
  let store = useMemo(() => debounce(setDebouncedValue, delay), [delay]);

  useEffect(() => {
    store(value);
    return () => store.cancel();
  }, [value, store]);

  return debouncedValue;
};
