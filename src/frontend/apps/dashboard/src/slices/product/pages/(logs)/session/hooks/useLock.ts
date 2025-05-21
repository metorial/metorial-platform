import { useEffect, useId, useState } from 'react';

export let useLock = () => {
  let [locks, setLocks] = useState<string[]>([]);

  let useLock = (cb: () => void) => {
    let id = useId();

    useEffect(() => {
      setLocks(locks => [...locks.filter(e => e !== id), id]);
      return () => setLocks(locks => locks.filter(e => e !== id));
    }, [id]);

    useEffect(() => {
      let firstLock = locks[0];
      if (firstLock === id) {
        cb();
        setLocks(locks => locks.filter(e => e !== id));
      }
    }, [id, locks]);
  };

  return { useLock };
};

export type UseLock = (cb: () => void) => void;
