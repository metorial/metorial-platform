import { Paginator, type PaginatorOpts } from '@lowerdeck/pagination';

type RemotePageInput = {
  limit: number;
  order: 'asc' | 'desc';
  after?: string;
  before?: string;
};

type RemotePage<T> = {
  items: T[];
  pagination: {
    hasMoreAfter: boolean;
    hasMoreBefore: boolean;
    after?: string;
    before?: string;
  };
};

let itemId = (item: unknown) => (item as { id?: string } | undefined)?.id;

export let createRemotePaginator = <T>(
  fetch: (page: RemotePageInput) => Promise<RemotePage<T>>,
  opts?: PaginatorOpts
) =>
  Paginator.create<T>(
    ({ externalCursor }) =>
      externalCursor(async page => {
        let result = await fetch({
          limit: page.limit,
          order: page.order,
          ...(page.direction == 'forward' ? { after: page.cursor } : { before: page.cursor })
        });

        let { pagination, items } = result;

        return {
          items,
          nextCursor: pagination.hasMoreAfter
            ? (pagination.after ?? itemId(items[items.length - 1]))
            : undefined,
          prevCursor: pagination.hasMoreBefore
            ? (pagination.before ?? itemId(items[0]))
            : undefined
        };
      }),
    opts
  );
