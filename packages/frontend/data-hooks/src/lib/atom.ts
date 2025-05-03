import { useLayoutEffect, useState } from 'react';
import { createListeners } from './listeners';

export let atom = <T>(initialValue?: T) => {
  let value = initialValue;
  let listeners = createListeners();

  let set = (newValue: T | ((oldValue: T) => T)) => {
    if (typeof newValue === 'function') {
      value = (newValue as any)(value!);
    } else {
      value = newValue;
    }

    listeners.notify();
  };

  let get = () => value!;

  let subscribe = (listener: (v: T) => void) => {
    let cb = () => listener(get()!);

    return listeners.register(cb);
  };

  return { set, get, subscribe };
};

export let useAtom = <T>(a: ReturnType<typeof atom<T>>) => {
  let [_, setState] = useState({});
  useLayoutEffect(
    () =>
      a.subscribe(() => {
        setState({});
      }),
    [a]
  );
  return a.get();
};
