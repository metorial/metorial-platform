import type { ValidationType } from '@lowerdeck/validation';
import { v } from '@lowerdeck/validation';
import { Cursor } from './cursor';
import type { PaginatedProvider, PaginatedProviderInput } from './paginatedProvider';
import { paginatedProviderMongoose, paginatedProviderPrisma } from './paginatedProvider';
import type { PaginatedList } from './types';

export interface PaginatorInput {
  limit?: number | string;
  after?: string;
  before?: string;
  cursor?: string;
  order?: 'asc' | 'desc';
}

export interface PaginatorInputStrict {
  limit?: number;
  after?: string;
  before?: string;
  cursor?: string;
  order?: 'asc' | 'desc';
}

export interface PaginatorOpts {
  defaultLimit?: number;
  defaultOrder?: 'asc' | 'desc';
}

export type Provider<T> = (providers: {
  prisma: typeof paginatedProviderPrisma;
  mongoose: typeof paginatedProviderMongoose;
}) => PaginatedProvider<T>;

export class Paginator<T> {
  private constructor(
    private provider: Provider<T>,
    private opts: PaginatorOpts = {}
  ) {}

  static create<T>(provider: Provider<T>, opts: PaginatorOpts = {}) {
    return new Paginator(provider, opts);
  }

  static validate<Inner extends object>(inner?: ValidationType<Inner>) {
    return v.intersection([
      v.object({
        limit: v.optional(
          v.number({
            modifiers: [v.minValue(1), v.maxValue(100)]
          })
        ),
        after: v.optional(v.string()),
        before: v.optional(v.string()),
        cursor: v.optional(v.string()),
        order: v.optional(v.enumOf(['asc', 'desc']))
      }),
      inner ?? v.object({})
    ]) as ValidationType<
      Inner & {
        limit?: number;
        after?: string;
        before?: string;
        cursor?: string;
        order?: 'asc' | 'desc';
      }
    >;
  }

  static present<T, R>(
    list: PaginatedList<T>,
    presenter: (item: T) => (context: any) => { run: (d: any) => R } | undefined
  ) {
    return (context: any) => ({
      run: async () => ({
        object: `list`,
        items: (
          await Promise.all(list.items.map(item => presenter(item)?.(context)?.run({})))
        ).filter(Boolean),
        pagination: {
          has_more_after: list.pagination.hasNextPage,
          has_more_before: list.pagination.hasPreviousPage
        }
      })
    });
  }

  static async presentLight<T, R>(
    list: PaginatedList<T>,
    presenter: (item: T) => R | Promise<R>
  ) {
    return {
      object: `list`,
      items: (await Promise.all(list.items.map(item => presenter(item)))).filter(Boolean),
      pagination: {
        has_more_after: list.pagination.hasNextPage,
        has_more_before: list.pagination.hasPreviousPage
      }
    };
  }

  static async presentInternal<T, R>(
    list: PaginatedList<T>,
    presenter: (item: T) => R | Promise<R>
  ) {
    return {
      object: `list`,
      items: (await Promise.all(list.items.map(item => presenter(item)))).filter(Boolean),
      pagination: {
        hasMoreAfter: list.pagination.hasNextPage,
        hasMoreBefore: list.pagination.hasPreviousPage
      }
    };
  }

  map<U>(mapper: (item: T) => U | Promise<U>): Paginator<U> {
    return this.mapAll(items => Promise.all(items.map(item => mapper(item))));
  }

  mapAll<U>(mapper: (items: T[]) => U[] | Promise<U[]>): Paginator<U> {
    return Paginator.create(
      providers => {
        let inner = this.provider(providers);

        return async input => {
          let list = await inner(input);
          let items = await mapper(list.items);

          return {
            ...list,
            items
          };
        };
      },
      this.opts
    );
  }

  async run(input: PaginatorInput): Promise<PaginatedList<T>> {
    let numberLimit = Number(input.limit);
    if (isNaN(numberLimit)) numberLimit = 20;

    let providerInput: PaginatedProviderInput = {
      limit: Math.max(
        Math.min(numberLimit ?? this.opts.defaultLimit ?? 20, this.opts.defaultLimit ?? 100),
        1
      ),
      order: input.order ?? this.opts.defaultOrder ?? 'asc'
    };

    if (input.after) {
      providerInput.after = input.after;
    } else if (input.before) {
      providerInput.before = input.before;
    } else if (input.cursor) {
      let cursor = Cursor.fromString(input.cursor);
      providerInput[cursor.type] = cursor.id;
    }

    let provider = this.provider({
      prisma: paginatedProviderPrisma,
      mongoose: paginatedProviderMongoose
    });

    return await provider(providerInput);
  }
}
