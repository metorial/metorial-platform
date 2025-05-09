import { ServiceError } from '@metorial/error';
import { Button, CenteredSpinner, Error } from '@metorial/ui';
import { MetorialSDKError } from '@metorial/util-endpoint';
import React, { Fragment, useEffect, useRef, useState } from 'react';

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
        ].map((el, i) => React.createElement(Fragment, { key: i, children: el }))
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

    return children(loaders as any);
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
    }
  >(
    loader: Loader,
    opts: {
      emptyState?: React.ReactNode;
      spaceTop?: number;
      spaceBottom?: number;
      padding?: number;
      loading?: () => React.ReactNode;
      error?: (error: ServiceError<any> | MetorialSDKError) => React.ReactNode;
    } = {}
  ) =>
  (
    children: (loaders: {
      input: Loader['input'];
      mutators: Loader['mutators'];
      data: NonNullable<Loader['data']>;
    }) => React.ReactNode
  ) => {
    let initialLoadRef = useRef(true);
    let directionRef = useRef<'next' | 'previous' | null>(null);

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
        ]
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

    if (loader.data?.items.length === 0) {
      return opts.emptyState ?? inner;
    }

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
                  directionRef.current = 'previous';
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
                  directionRef.current = 'next';
                  loader.next();
                }
              },
              'Next'
            )
          ]
        )
      ]
    );
  };
