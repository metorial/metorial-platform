import { useEffect, useState } from 'react';

export let useNonNullable = <T>(value: T | null | undefined): T => {
  let [val, setVal] = useState(() => value);

  useEffect(() => {
    if (value) setVal(value);
  }, [value]);

  return val as T;
};
