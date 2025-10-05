import { Error } from '@metorial/ui';
import PQueue from 'p-queue';
import React, { ReactNode, useEffect, useRef, useState } from 'react';

let queue = new PQueue({ concurrency: 10 });

let requestIdleCallbackWithFallback =
  typeof requestIdleCallback != 'undefined'
    ? requestIdleCallback
    : (cb: () => any, opts: any) => cb();

export let dynamicPage = <Params extends any[]>(
  loader: () => Promise<(...p: Params) => ReactNode>
) => {
  let loadPromise: Promise<(p: any) => ReactNode> | null = null;

  // @ts-ignore
  if (import.meta.env.PROD) {
    setTimeout(() => {
      requestIdleCallbackWithFallback(
        () =>
          queue.add(async () => {
            loadPromise = loadPromise ?? (loader() as any);

            try {
              await loadPromise;
            } catch (e) {}
          }),
        { timeout: 120_000 }
      );
    }, 5000);
  }

  return (props: Params[0] extends undefined ? {} : Params[0]) => {
    let [Component, setComponent] = useState<((p: any) => ReactNode) | null>(null);
    let [spinner, setSpinner] = useState(false);
    let [error, setError] = useState(false);
    let completedRef = useRef(false);

    useEffect(() => {
      if (loadPromise == null) {
        loadPromise = loader() as any;
      }

      loadPromise!
        .then(c => {
          setComponent(() => c);
          completedRef.current = true;
        })
        .catch(() => {
          setError(true);

          let current = new URL(window.location.href);
          // Avoid infinite reload loop
          if (current.searchParams.has('_cmp_ref')) return;

          current.searchParams.set('_cmp_ref', Date.now().toString());
          window.location.href = current.toString();
        });

      setTimeout(() => {
        if (!completedRef.current) setSpinner(true);
      }, 500);
    }, []);

    // if (!Component && error) return <Error>Unable to load page</Error>;
    if (!Component && error) return React.createElement(Error, null, 'Unable to load page');

    // if (!Component && spinner) {
    //   return React.createElement(
    //     'div',
    //     {
    //       style: {
    //         marginTop: 20
    //       }
    //     },
    //     React.createElement(CenteredSpinner, null)
    //   );
    // }

    if (Component) return React.createElement(Component as any, props as any);

    return null;
  };
};

export let dynamicComponent = dynamicPage;

export let dynamicFunction = <Params extends any[], Return>(
  loader: () => Promise<(...p: Params) => Return>
) => {
  let loadPromise: Promise<(...p: Params) => Return> | null = null;

  return async (...params: Params) => {
    if (!loadPromise) loadPromise = loader();
    let fn = await loadPromise;
    return fn(...params);
  };
};
