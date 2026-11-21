import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';

type GatewayPageInput = {
  limit: number;
  order: 'asc' | 'desc';
  after?: string;
  before?: string;
};

type GatewayPage<T> = {
  items: T[];
  pagination: { has_more_after: boolean; has_more_before: boolean };
};

type GatewayLogPage<T> = {
  items: T[];
  hasMore: boolean;
  nextCursor: string | null;
};

// Gateway lists are Prisma-paginated by item id, so the edge items are the cursors.
export let createGatewayPaginator = <T extends { id: string }>(
  fetch: (page: GatewayPageInput) => Promise<GatewayPage<T>>
) =>
  Paginator.create<T>(({ externalCursor }) =>
    externalCursor(async page => {
      let cursor = page.cursor
        ? page.direction == 'forward'
          ? { after: page.cursor }
          : { before: page.cursor }
        : {};

      let { items, pagination } = await fetch({
        limit: page.limit,
        order: page.order,
        ...cursor
      });

      return {
        items,
        nextCursor: pagination.has_more_after ? items[items.length - 1]?.id : undefined,
        prevCursor: pagination.has_more_before ? items[0]?.id : undefined
      };
    })
  );

// Inference logs are always newest first and can only be paged towards older entries.
export let createGatewayLogPaginator = <T>(
  fetch: (page: { limit: number; before?: string }) => Promise<GatewayLogPage<T>>
) =>
  Paginator.create<T>(({ externalCursor }) =>
    externalCursor(async page => {
      if (page.direction == 'backward') {
        throw new ServiceError(
          badRequestError({ message: 'Inference logs can only be paged forward.' })
        );
      }

      let result = await fetch({ limit: page.limit, before: page.cursor });

      return {
        items: result.items,
        nextCursor: result.hasMore ? (result.nextCursor ?? undefined) : undefined
      };
    })
  );
