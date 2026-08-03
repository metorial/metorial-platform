import { useEffect, useState } from 'react';

export let useNow = () => {
  let [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    let interval = setInterval(() => setNow(new Date()), 30 * 1000);

    return () => clearInterval(interval);
  }, []);

  return now;
};
