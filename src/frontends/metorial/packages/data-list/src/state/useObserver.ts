import { useEffect, useState } from 'react';
import { Observer } from './observer';

export let useObserver = <T>(observer: Observer<T>) => {
  let [state, setState] = useState(() => observer.lastValue);

  useEffect(() => {
    return observer.subscribe(value => setState(value));
  }, [observer]);

  return state;
};
