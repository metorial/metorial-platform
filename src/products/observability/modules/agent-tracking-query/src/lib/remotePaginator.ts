import { Paginator } from '@lowerdeck/pagination';

export type RemotePageInput = {
  limit: number;
  order: 'asc' | 'desc';
  after?: string;
  before?: string;
};

export type RemotePage<T> = {
  items: T[];
  hasMoreAfter: boolean;
  hasMoreBefore: boolean;
  after?: string;
  before?: string;
};

export let createRemotePaginator = <T>(
  fetch: (page: RemotePageInput) => Promise<RemotePage<T>>
) =>
  Paginator.create<T>(
    ({ externalCursor }) =>
      externalCursor(async page => {
        let result = await fetch({
          limit: page.limit,
          order: page.order,
          ...(page.cursor === undefined
            ? {}
            : page.direction == 'forward'
              ? { after: page.cursor }
              : { before: page.cursor })
        });

        return {
          items: result.items,
          nextCursor: result.hasMoreAfter ? result.after : undefined,
          prevCursor: result.hasMoreBefore ? result.before : undefined
        };
      }),
    { defaultOrder: 'desc' }
  );
