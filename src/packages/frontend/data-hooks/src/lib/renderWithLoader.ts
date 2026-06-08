import { ServiceError } from '@lowerdeck/error';
import { Button, CenteredSpinner, Error } from '@metorial/ui';
import { MetorialSDKError } from '@metorial/util-endpoint';
import React, {
  Fragment,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { useSearchParams } from 'react-router-dom';
import { useInitialLoadBoundaryState, useInitialLoadRegistration } from './initialLoad';
import { usePaginationSearchParamsEnabled } from './paginationSearchParams';

type LoaderLike = {
  input?: any;
  data: any;
  error: ServiceError<any> | MetorialSDKError | null | undefined;
  isLoading: boolean;
  mutators?: {
    [key: string]: (...args: any[]) => Promise<any>;
  };
  refetch?: () => void;
};

type RenderWithLoaderLoaders = {
  [key: string]: LoaderLike | boolean;
};

type RenderWithLoaderOptions = {
  spaceTop?: number | string;
  spaceBottom?: number | string;
  loading?: () => React.ReactNode;
  error?: (error: ServiceError<any> | MetorialSDKError) => React.ReactNode;
};

type LoaderError = ServiceError<any> | MetorialSDKError;

type RenderWithLoaderChildren<Loaders extends RenderWithLoaderLoaders> = (loaders: {
  [K in keyof Loaders]: Loaders[K] extends object
    ? {
        input: Loaders[K]['input'];
        mutators: Loaders[K]['mutators'];
        data: NonNullable<Loaders[K]['data']>;
        refetch: () => void;
      }
    : undefined;
}) => React.ReactNode;

type InitialLoaderGate = {
  register: (id: symbol, isPending: boolean) => void;
};

type InitialRevealPhase = 'localLoading' | 'discovering' | 'revealed';

let LOADER_SPINNER_DELAY_MS = 100;

let InitialLoaderGateContext = createContext<InitialLoaderGate | null>(null);

let renderLoadingContent = (opts: RenderWithLoaderOptions) =>
  React.createElement(Fragment, {
    children: [
      opts.spaceTop ? React.createElement('div', { style: { height: opts.spaceTop } }) : null,
      opts.loading ? opts.loading() : React.createElement(CenteredSpinner),
      opts.spaceBottom
        ? React.createElement('div', { style: { height: opts.spaceBottom } })
        : null
    ].map((el, i) => React.createElement(Fragment, { key: `l-${i}`, children: el }))
  });

let renderLoaderSpinner = (opts: RenderWithLoaderOptions, visible: boolean) =>
  React.createElement('div', {
    style: {
      opacity: visible ? 1 : 0,
      visibility: visible ? 'visible' : 'hidden',
      pointerEvents: visible ? undefined : 'none'
    },
    children: renderLoadingContent(opts)
  });

let renderLoaderError = (error: LoaderError, opts: RenderWithLoaderOptions) =>
  opts.error
    ? opts.error(error)
    : React.createElement(Error, {
        children:
          ('data' in error ? error.data.message : error.message) ??
          error.message ??
          'An error occurred'
      });

let renderContentStyle = (visible: boolean): React.CSSProperties =>
  visible
    ? { display: 'contents' }
    : {
        display: 'block',
        height: 0,
        opacity: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        visibility: 'hidden'
      };

let RenderWithLoaderInner = <Loaders extends RenderWithLoaderLoaders>({
  loaders,
  opts,
  children
}: {
  loaders: Loaders;
  opts: RenderWithLoaderOptions;
  children: RenderWithLoaderChildren<Loaders>;
}) => {
  let parentGate = useContext(InitialLoaderGateContext);
  let boundary = useInitialLoadBoundaryState();
  let idRef = useRef(Symbol('renderWithLoader'));
  let normalizedLoaders = Object.values(loaders).map(loader =>
    typeof loader == 'boolean' ? { isLoading: loader, error: undefined } : loader
  );

  let isLoading = Object.values(normalizedLoaders).some(loader => loader.isLoading);
  let error = Object.values(normalizedLoaders).find(loader => loader.error != null)?.error;
  let hasError = !!error;
  let [phase, setPhase] = useState<InitialRevealPhase>(() =>
    isLoading ? 'localLoading' : 'revealed'
  );
  let phaseRef = useRef(phase);
  let nestedPendingRef = useRef(new Set<symbol>());
  let discoveryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  let [nestedPendingCount, setNestedPendingCount] = useState(0);
  let [spinnerDelayComplete, setSpinnerDelayComplete] = useState(false);

  phaseRef.current = phase;

  let clearDiscoveryTimeout = useCallback(() => {
    if (!discoveryTimeoutRef.current) return;

    clearTimeout(discoveryTimeoutRef.current);
    discoveryTimeoutRef.current = null;
  }, []);

  let scheduleDiscoveryReveal = useCallback(() => {
    clearDiscoveryTimeout();
    discoveryTimeoutRef.current = setTimeout(() => {
      discoveryTimeoutRef.current = null;
      if (phaseRef.current == 'discovering') setPhase('revealed');
    }, 10);
  }, [clearDiscoveryTimeout]);

  let register = useCallback(
    (id: symbol, isPending: boolean) => {
      let phase = phaseRef.current;
      if (phase == 'revealed') return;
      if (nestedPendingRef.current.has(id) == isPending) return;

      let nextNestedPending = new Set(nestedPendingRef.current);

      if (isPending) nextNestedPending.add(id);
      else nextNestedPending.delete(id);

      nestedPendingRef.current = nextNestedPending;
      setNestedPendingCount(nextNestedPending.size);

      if (phase != 'discovering') return;

      if (nextNestedPending.size > 0) clearDiscoveryTimeout();
      else scheduleDiscoveryReveal();
    },
    [clearDiscoveryTimeout, scheduleDiscoveryReveal]
  );

  let gate = useMemo<InitialLoaderGate>(() => ({ register }), [register]);

  let hasNotRevealed = phase != 'revealed';
  let usesSharedBoundary = boundary?.isAccepting() ?? false;
  let isPendingForParent =
    !usesSharedBoundary &&
    !hasError &&
    (phase == 'localLoading' || (phase == 'discovering' && nestedPendingCount > 0));
  let isPendingForBoundary = hasNotRevealed && !hasError;
  let isVisiblyPending = (hasNotRevealed && !hasError) || (phase == 'revealed' && isLoading);
  let shouldRenderOwnSpinner = isVisiblyPending && !(usesSharedBoundary && hasNotRevealed);
  let providedGate = !usesSharedBoundary && hasNotRevealed ? gate : null;

  useInitialLoadRegistration(isPendingForBoundary);

  useEffect(() => {
    if (phase != 'localLoading' || isLoading || hasError) return;

    if (usesSharedBoundary) {
      setPhase('revealed');
    } else {
      setPhase('discovering');
      if (nestedPendingRef.current.size == 0) scheduleDiscoveryReveal();
    }
  }, [hasError, isLoading, phase, scheduleDiscoveryReveal, usesSharedBoundary]);

  useEffect(() => {
    parentGate?.register(idRef.current, isPendingForParent);
    return () => parentGate?.register(idRef.current, false);
  }, [isPendingForParent, parentGate]);

  useEffect(() => {
    if (!isVisiblyPending) {
      setSpinnerDelayComplete(false);
      return;
    }

    setSpinnerDelayComplete(false);
    let timeout = setTimeout(() => setSpinnerDelayComplete(true), LOADER_SPINNER_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [isVisiblyPending]);

  useEffect(() => {
    if (hasError || phase == 'revealed') clearDiscoveryTimeout();
  }, [clearDiscoveryTimeout, hasError, phase]);

  useEffect(() => {
    if (phase != 'revealed' || nestedPendingRef.current.size == 0) return;

    nestedPendingRef.current = new Set();
    setNestedPendingCount(0);
  }, [phase]);

  useEffect(() => () => clearDiscoveryTimeout(), [clearDiscoveryTimeout]);

  if (error) {
    return renderLoaderError(error, opts);
  }

  let canRenderChildren = !isLoading && !hasError && phase != 'localLoading';
  let inner = canRenderChildren
    ? React.createElement('div', {
        key: 'content',
        style: renderContentStyle(phase == 'revealed'),
        children: children(loaders as any)
      })
    : null;

  return React.createElement(InitialLoaderGateContext.Provider, {
    value: providedGate,
    children: React.createElement(Fragment, {
      children: [
        shouldRenderOwnSpinner
          ? React.createElement(Fragment, {
              key: 'spinner',
              children: renderLoaderSpinner(opts, spinnerDelayComplete)
            })
          : null,
        inner
      ]
    })
  });
};

export let renderWithLoader =
  <Loaders extends RenderWithLoaderLoaders>(
    loaders: Loaders,
    opts: RenderWithLoaderOptions = {}
  ) =>
  (children: RenderWithLoaderChildren<Loaders>) =>
    React.createElement(RenderWithLoaderInner, { loaders, opts, children: children as any });

export let renderWithPagination =
  <
    Loader extends {
      input?: any;
      data: {
        items: any[];
        pagination: {
          hasMoreBefore: boolean;
          hasMoreAfter: boolean;
        };
      } | null;
      error: ServiceError<any> | MetorialSDKError | null | undefined;
      isLoading: boolean;
      mutators?: {
        [key: string]: (...args: any[]) => Promise<any>;
      };
      next: () => void;
      previous: () => void;
      refetch: () => void;
    }
  >(
    loader: Loader,
    opts: {
      emptyState?: React.ReactNode;
      spaceTop?: number;
      spaceBottom?: number;
      padding?: number;
      hidePaginationWhenUnavailable?: boolean;
      loading?: () => React.ReactNode;
      error?: (error: ServiceError<any> | MetorialSDKError) => React.ReactNode;
    } = {}
  ) =>
  (
    children: (loaders: {
      input: Loader['input'];
      mutators: Loader['mutators'];
      data: NonNullable<Loader['data']>;
      refetch: () => void;
    }) => React.ReactNode
  ) => {
    let boundary = useInitialLoadBoundaryState();
    let initialLoadRef = useRef(true);
    let directionRef = useRef<'next' | 'previous' | null>(null);
    let [, setSearchParams] = useSearchParams();
    let paginationSearchParamsEnabled = usePaginationSearchParamsEnabled();

    let [items, setItems] = useState(() => loader.data?.items ?? []);
    useEffect(() => {
      if (!loader.isLoading || loader.data?.items.length) {
        setItems(loader.data?.items ?? []);
      }
    }, [loader.isLoading, loader.data?.items]);

    if (!loader.isLoading && initialLoadRef.current) initialLoadRef.current = false;

    let isInitialLoading = loader.isLoading && initialLoadRef.current;

    useInitialLoadRegistration(isInitialLoading);

    if (isInitialLoading) {
      if (boundary?.isAccepting()) return null;

      return renderLoadingContent(opts);
    }

    if (loader.error) {
      return renderLoaderError(loader.error, opts);
    }

    let loaderWithCachedData = {
      ...loader,
      data: {
        ...loader.data,
        items
      }
    };

    // let inner = children(loaderWithCachedData as any);

    let inner = React.createElement(children, loaderWithCachedData as any);
    let shouldShowPagination =
      !opts.hidePaginationWhenUnavailable ||
      !!loader.data?.pagination.hasMoreBefore ||
      !!loader.data?.pagination.hasMoreAfter;

    if (loader.data?.items.length === 0) {
      return opts.emptyState ?? inner;
    }

    if (!shouldShowPagination) return inner;

    return React.createElement(
      'div',
      {
        style: {
          display: 'flex',
          flexDirection: 'column',
          gap: 10
        }
      },
      [
        inner,
        React.createElement(
          'div',
          {
            style: {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 10,
              marginRight: opts.padding,
              paddingBottom: opts.padding
            }
          },
          [
            React.createElement(
              Button,
              {
                disabled: !loader.data?.pagination.hasMoreBefore || loader.isLoading,
                variant: 'outline',
                loading: loader.isLoading && directionRef.current == 'previous',
                size: '2',
                onClick: () => {
                  let firstItem = loader.data?.items[0];
                  if (!firstItem) return;

                  directionRef.current = 'previous';
                  if (paginationSearchParamsEnabled) {
                    setSearchParams(
                      currentSearchParams => {
                        let nextSearchParams = new URLSearchParams(currentSearchParams);
                        nextSearchParams.set('before', firstItem.id);
                        nextSearchParams.delete('after');
                        return nextSearchParams;
                      },
                      { replace: true }
                    );
                  }
                  loader.previous();
                }
              },
              'Previous'
            ),
            React.createElement(
              Button,
              {
                disabled: !loader.data?.pagination.hasMoreAfter || loader.isLoading,
                variant: 'outline',
                loading: loader.isLoading && directionRef.current == 'next',
                size: '2',
                onClick: () => {
                  let lastItem = loader.data?.items[loader.data.items.length - 1];
                  if (!lastItem) return;

                  directionRef.current = 'next';
                  if (paginationSearchParamsEnabled) {
                    setSearchParams(
                      currentSearchParams => {
                        let nextSearchParams = new URLSearchParams(currentSearchParams);
                        nextSearchParams.set('after', lastItem.id);
                        nextSearchParams.delete('before');
                        return nextSearchParams;
                      },
                      { replace: true }
                    );
                  }
                  loader.next();
                }
              },
              'Next'
            )
          ].map((el, i) => React.createElement(Fragment, { key: `b-${i}`, children: el }))
        )
      ].map((el, i) => React.createElement(Fragment, { key: `p-${i}`, children: el }))
    );
  };
