import { ServiceError } from '@lowerdeck/error';
import { Button, CenteredSpinner, Error } from '@metorial/ui';
import { MetorialSDKError } from '@metorial/util-endpoint';
import React, { Fragment, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePaginationSearchParamsEnabled } from './paginationSearchParams';

export let renderWithLoader =
  <
    Loaders extends {
      [key: string]:
        | {
            input?: any;
            data: any;
            error: ServiceError<any> | MetorialSDKError | null | undefined;
            isLoading: boolean;
            mutators?: {
              [key: string]: (...args: any[]) => Promise<any>;
            };
            refetch: () => void;
          }
        | boolean;
    }
  >(
    loaders: Loaders,
    opts: {
      spaceTop?: number | string;
      spaceBottom?: number | string;
      loading?: () => React.ReactNode;
      error?: (error: ServiceError<any> | MetorialSDKError) => React.ReactNode;
    } = {}
  ) =>
  (
    children: (loaders: {
      [K in keyof Loaders]: Loaders[K] extends object
        ? {
            input: Loaders[K]['input'];
            mutators: Loaders[K]['mutators'];
            data: NonNullable<Loaders[K]['data']>;
            refetch: () => void;
          }
        : undefined;
    }) => React.ReactNode
  ) => {
    let normalizedLoaders = Object.values(loaders).map(loader =>
      typeof loader == 'boolean' ? { isLoading: loader, error: undefined } : loader
    );

    let isLoading = Object.values(normalizedLoaders).some(loader => loader.isLoading);
    let error = Object.values(normalizedLoaders).find(loader => loader.error !== null)?.error;

    if (isLoading) {
      return React.createElement(Fragment, {
        children: [
          opts.spaceTop
            ? React.createElement('div', { style: { height: opts.spaceTop } })
            : null,
          opts.loading ? opts.loading() : React.createElement(CenteredSpinner),
          opts.spaceBottom
            ? React.createElement('div', { style: { height: opts.spaceBottom } })
            : null
        ].map((el, i) => React.createElement(Fragment, { key: `l-${i}`, children: el }))
      });
    }

    if (error) {
      return opts.error
        ? opts.error(error)
        : React.createElement(Error, {
            children:
              ('data' in error ? error.data.message : error.message) ??
              error.message ??
              'An error occurred'
          });
    }

    // return children(loaders as any);

    return React.createElement(Fragment, { children: children(loaders as any) });
  };

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

    if (loader.isLoading && initialLoadRef.current) {
      return React.createElement(Fragment, {
        children: [
          opts.spaceTop
            ? React.createElement('div', { style: { height: opts.spaceTop } })
            : null,
          opts.loading ? opts.loading() : React.createElement(CenteredSpinner),
          opts.spaceBottom
            ? React.createElement('div', { style: { height: opts.spaceBottom } })
            : null
        ].map((el, i) => React.createElement(Fragment, { key: `l-${i}`, children: el }))
      });
    }

    if (loader.error) {
      return opts.error
        ? opts.error(loader.error)
        : React.createElement(Error, {
            children:
              ('data' in loader.error ? loader.error.data.message : loader.error.message) ??
              loader.error.message ??
              'An error occurred'
          });
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
