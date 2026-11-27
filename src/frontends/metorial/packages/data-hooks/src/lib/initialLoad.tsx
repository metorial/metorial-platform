import { CenteredSpinner } from '@metorial/ui';
import React, {
  Fragment,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore
} from 'react';

type InitialLoadCoordinatorContextValue = {
  isAccepting: () => boolean;
  register: (id: symbol, isPending: boolean) => void;
};

let INITIAL_LOAD_SPINNER_DELAY_MS = 100;
let INITIAL_LOAD_SETTLE_MS = 10;

let InitialLoadCoordinatorContext = createContext<InitialLoadCoordinatorContextValue | null>(
  null
);

let createInitialLoadStore = () => {
  let pending = new Set<symbol>();
  let listeners = new Set<() => void>();
  let accepting = true;

  let emit = () => {
    for (let listener of listeners) listener();
  };

  return {
    getSnapshot: () => pending.size,
    isAccepting: () => accepting,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    register: (id: symbol, isPending: boolean) => {
      if (!accepting && isPending && !pending.has(id)) return;
      if (pending.has(id) == isPending) return;

      if (isPending) pending.add(id);
      else pending.delete(id);

      emit();
    },
    stopAccepting: () => {
      accepting = false;
    }
  };
};

export let useInitialLoadBoundaryState = () => useContext(InitialLoadCoordinatorContext);

export let useInitialLoadRegistration = (isPending: boolean) => {
  let coordinator = useInitialLoadBoundaryState();
  let idRef = useRef(Symbol('initialLoad'));
  let register = coordinator?.register;

  useEffect(() => {
    register?.(idRef.current, isPending);
    return () => register?.(idRef.current, false);
  }, [isPending, register]);
};

let renderBoundarySpinner = (p: {
  active: boolean;
  loading?: () => React.ReactNode;
  visible: boolean;
}) =>
  React.createElement('div', {
    style: {
      display: p.active ? undefined : 'none',
      opacity: p.visible ? 1 : 0,
      visibility: p.visible ? 'visible' : 'hidden',
      pointerEvents: p.visible ? undefined : 'none'
    },
    children: p.loading ? p.loading() : React.createElement(CenteredSpinner)
  });

type InitialLoadPhase = 'watching' | 'pending' | 'revealed';

let InitialLoadBody = (p: {
  children: React.ReactNode;
  loading?: () => React.ReactNode;
  store: ReturnType<typeof createInitialLoadStore>;
}) => {
  let pendingCount = useSyncExternalStore(
    p.store.subscribe,
    p.store.getSnapshot,
    p.store.getSnapshot
  );
  let [phase, setPhase] = useState<InitialLoadPhase>('watching');
  let [spinnerDelayComplete, setSpinnerDelayComplete] = useState(false);
  let isPending = phase == 'pending' || (phase == 'watching' && pendingCount > 0);

  useEffect(() => {
    if (phase == 'revealed') return;

    if (pendingCount > 0) {
      if (phase != 'pending') setPhase('pending');
      return;
    }

    let timeout = setTimeout(() => {
      p.store.stopAccepting();
      setPhase('revealed');
    }, INITIAL_LOAD_SETTLE_MS);
    return () => clearTimeout(timeout);
  }, [p.store, pendingCount, phase]);

  useEffect(() => {
    if (!isPending) {
      if (spinnerDelayComplete) setSpinnerDelayComplete(false);
      return;
    }

    if (spinnerDelayComplete) return;

    let timeout = setTimeout(
      () => setSpinnerDelayComplete(true),
      INITIAL_LOAD_SPINNER_DELAY_MS
    );
    return () => clearTimeout(timeout);
  }, [isPending, spinnerDelayComplete]);

  return React.createElement(Fragment, {
    children: [
      React.createElement(Fragment, {
        key: 'initial-load-spinner',
        children: renderBoundarySpinner({
          active: isPending,
          loading: p.loading,
          visible: isPending && (pendingCount > 0 || spinnerDelayComplete)
        })
      }),
      React.createElement('div', {
        key: 'initial-load-content',
        style: {
          display: isPending ? 'block' : 'contents',
          height: isPending ? 0 : undefined,
          opacity: isPending ? 0 : undefined,
          overflow: isPending ? 'hidden' : undefined,
          pointerEvents: isPending ? 'none' : undefined,
          visibility: isPending ? 'hidden' : undefined
        },
        children: p.children
      })
    ]
  });
};

export let InitialLoadBoundary = (p: {
  children: React.ReactNode;
  loading?: () => React.ReactNode;
}) => {
  let storeRef = useRef<ReturnType<typeof createInitialLoadStore> | null>(null);
  if (!storeRef.current) storeRef.current = createInitialLoadStore();

  let store = storeRef.current;
  let value = useMemo<InitialLoadCoordinatorContextValue>(
    () => ({ isAccepting: store.isAccepting, register: store.register }),
    [store]
  );

  return React.createElement(InitialLoadCoordinatorContext.Provider, {
    value,
    children: React.createElement(InitialLoadBody, {
      loading: p.loading,
      store,
      children: p.children
    })
  });
};
