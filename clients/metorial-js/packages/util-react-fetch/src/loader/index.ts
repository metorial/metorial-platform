import { isMetorialSDKError, MetorialSDKError } from '@metorial/util-endpoint';
import { memo } from '@metorial/util-memo';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { onError } from '../handlers';
import { useMutation } from '../hooks/useMutation';
import { onFocus } from '../lib/onFocus';
import { Observable } from './observable';

export interface LoaderState<I, O> {
  input: I;
  output: O | null;
  error: MetorialSDKError | null;
}

let allStates = new Map<string, Map<string, any>>();

export interface UseReturn<I, O, M extends { [key: string]: (...args: any) => any }> {
  input: I | null;
  data: O | null;
  error: MetorialSDKError | null;
  isLoading: boolean;
  mutators: M;
  refetch: () => void;
  use: () => UseReturn<I, O, M>;
  useMutator: <K extends keyof M>(
    mutator: K
  ) => () => ReturnType<typeof useMutation<Parameters<M[K]>[0], Awaited<ReturnType<M[K]>>>>;
}

export let createLoader = <
  O,
  Mutators extends {
    [key: string]: (
      data: any,
      ctx: { input: I; output: O; setOutput: (output: O) => void }
    ) => Promise<any>;
  },
  I = void
>(opts: {
  name: string;
  fetch: (d: I) => Promise<O>;
  hash: (d: I) => string;
  polling?: {
    interval: number;
  };
  mutators: Mutators;
  onError?: (error: MetorialSDKError) => void;
  onSuccess?: (output: O) => void;
  parents?: { refetchAll: () => any }[];
}) => {
  let refetchParents = () => {
    for (let parent of opts.parents ?? []) {
      parent.refetchAll();
    }
  };

  type State = {
    state: Observable<LoaderState<I, O>>;
    lastFetchedAt: number;
    active: boolean;
  };

  let states = allStates.get(opts.name) as Map<string, State>;
  if (!states) {
    states = new Map();
    allStates.set(opts.name, states);
  }

  let ensureState = memo((input: I) => {
    let hash = opts.hash(input);

    let state = states.get(hash);
    if (!state) {
      state = {
        state: new Observable<LoaderState<I, O>>({
          input,
          output: null,
          error: null
        }),
        lastFetchedAt: 0,
        active: false
      };

      states.set(hash, state);
    }

    return state;
  });

  let getMutators = memo(({ current, refetch }: { current: State; refetch: () => void }) => {
    return Object.fromEntries(
      Object.entries(opts.mutators ?? {}).map(([key, mutator]) => {
        return [
          key,
          async (data: any) => {
            try {
              let res = await mutator(data, {
                input: current.state.value!.input!,
                output: current.state.value!.output!,
                setOutput: (output: O) => {
                  current.state.next({
                    ...current.state.value!,
                    output
                  });
                }
              });

              // To avoid race conditions with parallel requests,
              // we always refetch the data after a mutation even
              // if the mutation used setOutput
              refetch();
              refetchParents();

              return res;
            } catch (error: any) {
              onError(error);

              if (isMetorialSDKError(error)) {
                throw error;
              } else {
                throw new MetorialSDKError({
                  status: 0,
                  code: 'unknown',
                  message: 'Unable to perform request'
                });
              }
            }
          }
        ];
      })
    ) as {
      [K in keyof Mutators]: (data: Parameters<Mutators[K]>[0]) => ReturnType<Mutators[K]>;
    };
  });

  let getInstanceFromCurrent = memo((current: State) => {
    let input = current.state.value.input;

    let fetchInner = async (input: I, fetchOpts?: { force?: boolean }) => {
      if (current.active) {
        // If the fetch is already in progress, wait for it to complete
        if (fetchOpts?.force) await new Promise(r => current.state.subscribeOnce(r));
        else return;
      }

      current.active = true;

      try {
        let output = await opts.fetch(input);
        current.state.next({ input, output, error: null });

        opts.onSuccess?.(output);
      } catch (error: any) {
        onError(error);

        if (isMetorialSDKError(error)) {
          current.state.next({
            input,
            output: current.state.value?.output ?? null,
            error: error as MetorialSDKError
          });

          opts.onError?.(error as MetorialSDKError);
        } else {
          let err = new MetorialSDKError({
            status: 0,
            code: 'unknown',
            message: 'Unable to perform request'
          });

          current.state.next({
            input,
            output: current.state.value?.output ?? null,
            error: err
          });

          opts.onError?.(err);
        }
      } finally {
        current.active = false;
        current.lastFetchedAt = Date.now();
      }
    };

    let fetch = async (input: I, fetchOpts?: { force?: boolean }) => {
      if (!fetchOpts?.force && Date.now() - current.lastFetchedAt < 10_000)
        return Promise.resolve();

      await fetchInner(input, fetchOpts);
    };

    if (current.active || Date.now() - current.lastFetchedAt > 60_000) fetch(input);

    return {
      fullState: current,
      state: current.state,
      mutators: getMutators({
        current,
        refetch: () => {
          fetch(input, { force: true });
        }
      }),
      fetch: ({ force = false } = {}) => fetch(input, { force })
    };
  });

  let getInstance = memo((input: I) => {
    let current = ensureState(input);

    return getInstanceFromCurrent(current);
  });

  let refetchAll = () => {
    if (document.hasFocus()) {
      for (let state of states.values()) {
        // Only fetch if there are listeners, i.e., it's being used
        // if (state.state.hasSubscribers()) {
        getInstance(state.state.value!.input!).fetch({ force: true });
        // }
      }
    }
  };

  if (opts.polling) {
    setInterval(refetchAll, opts.polling.interval);
    onFocus(refetchAll);
  }

  let fetchManual = async (input: I) => {
    let inst = getInstance(input);

    inst.fetch();

    return inst.state;
  };

  let waitForBase = (state: Observable<LoaderState<I, O>>) => {
    return new Promise<O>((resolve, reject) => {
      if (state.value?.output) {
        resolve(state.value.output);
      } else if (state.value?.error) {
        reject(state.value.error);
      } else {
        let unsubscribe = state.subscribe(s => {
          if (s.output) {
            unsubscribe();
            resolve(s.output);
          } else if (s.error) {
            unsubscribe();
            reject(s.error);
          }
        });
      }
    });
  };

  let waitFor = (input: I) => waitForBase(ensureState(input).state);

  let fetchAndReturn = async (input: I) => waitForBase(await fetchManual(input));

  let use = (input: I | null): UseReturn<I, O, ReturnType<typeof getMutators>> => {
    let subStateRefs = useRef<{ current: (input: I) => void }[]>([]);

    let currentInstance = useMemo(() => (input === null ? null : getInstance(input)), [input]);
    let [state, setState] = useState<LoaderState<I, O>>(() => currentInstance?.state.value!);

    useLayoutEffect(() => {
      if (!currentInstance) return;

      setState(currentInstance.state.value);
      let unsubscribe = currentInstance.state.subscribe(() => {
        setState(currentInstance!.state.value);
      });
      return () => unsubscribe();
    }, [currentInstance, currentInstance?.state]);

    useEffect(() => {
      if (!currentInstance) return;
      currentInstance.fetch();
    }, [currentInstance]);

    useEffect(() => {
      if (input) subStateRefs.current.forEach(r => r.current(input));
    }, [input]);

    return {
      input: state?.input,
      data: state?.output,
      error: state?.error,
      isLoading: !state || (!state.output && !state.error),
      mutators: (currentInstance?.mutators ?? {}) as ReturnType<typeof getMutators>,

      refetch: () => currentInstance?.fetch({ force: true }),

      useMutator: (mutator: keyof Mutators) => () =>
        useMutation(currentInstance?.mutators[mutator]),

      use: () => {
        let [input, setInput] = useState<I | null>(currentInstance?.state.value.input ?? null);

        useLayoutEffect(() => {
          subStateRefs.current.push({ current: setInput });

          return () => {
            subStateRefs.current = subStateRefs.current.filter(r => r.current !== setInput);
          };
        }, [setInput]);

        return use(input);
      }
    };
  };

  return {
    refetchAll,

    fetch: fetchManual,
    waitFor,
    fetchAndReturn,

    getState: (input: I) => {
      let current = ensureState(input);
      return current.state.value!;
    },

    subscribe: (input: I, callback: (state: LoaderState<I, O>) => void) => {
      let current = ensureState(input);
      return current.state.subscribe(callback);
    },

    use
  };
};
