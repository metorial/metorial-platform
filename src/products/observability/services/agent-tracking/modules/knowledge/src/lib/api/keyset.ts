import { Paginator } from '@lowerdeck/pagination';
import { Prisma } from '@mtsrc/agent-tracking-db';
import { db } from '@mtsrc/agent-tracking-db';

export type SortOrder = 'asc' | 'desc';

export let whereAll = (conditions: Prisma.Sql[]) =>
  conditions.length ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}` : Prisma.empty;

export let likePattern = (value: string) =>
  `%${value.replace(/[\\%_]/g, char => `\\${char}`)}%`;

// Pages over `ORDER BY key, id`. The cursor is the item id, as with Prisma pagination, and the
// cursor row's key is recomputed in a subquery, so `after: item.id` works like on every other list.
export let keysetPaginator = <T extends { id: string }>(d: {
  from: Prisma.Sql;
  id: Prisma.Sql;
  where: Prisma.Sql[];
  key?: (order: SortOrder) => Prisma.Sql;
  load: (ids: string[]) => Promise<T[]>;
}) =>
  Paginator.create<string>(({ externalCursor }) =>
    externalCursor(async page => {
      let backward = page.direction == 'backward';
      let ascending = (page.order == 'asc') != backward;
      let direction = Prisma.raw(ascending ? 'ASC' : 'DESC');
      let comparison = Prisma.raw(ascending ? '>' : '<');
      let key = d.key?.(page.order);

      let conditions = [...d.where];
      if (page.cursor) {
        conditions.push(
          key
            ? Prisma.sql`(${key}, ${d.id}) ${comparison} (SELECT ${key}, ${d.id} FROM ${d.from} WHERE ${d.id} = ${page.cursor})`
            : Prisma.sql`${d.id} ${comparison} ${page.cursor}`
        );
      }

      let orderBy = key
        ? Prisma.sql`ORDER BY ${key} ${direction}, ${d.id} ${direction}`
        : Prisma.sql`ORDER BY ${d.id} ${direction}`;

      let rows = await db.$queryRaw<{ id: string }[]>(
        Prisma.sql`SELECT ${d.id} AS id FROM ${d.from} ${whereAll(conditions)} ${orderBy} LIMIT ${page.limit + 1}`
      );

      let hasMore = rows.length > page.limit;
      let ids = rows.slice(0, page.limit).map(row => row.id);
      if (backward) ids.reverse();

      let first = ids[0];
      let last = ids[ids.length - 1];

      return {
        items: ids,
        nextCursor: (backward ? !!page.cursor : hasMore) ? last : undefined,
        prevCursor: (backward ? hasMore : !!page.cursor) ? first : undefined
      };
    })
  ).mapAll(async ids => {
    let items = new Map((await d.load(ids)).map(item => [item.id, item]));

    return ids.map(id => items.get(id)).filter((item): item is T => !!item);
  });
