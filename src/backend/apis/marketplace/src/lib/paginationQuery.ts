import { z } from 'zod';
import { paginatorSchema } from './paginatorSchema';

type PaginatorQuery = z.infer<typeof paginatorSchema>;

export let toPaginationQuery = (query: PaginatorQuery) => ({
  limit: query.limit ? Number(query.limit) : undefined,
  after: query.after,
  before: query.before,
  order: query.order
});
