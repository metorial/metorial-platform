import { PresenterContext } from '@metorial/presenter';
import { v, ValidationType } from '@metorial/validation';
import { Cursor } from './cursor';
import {
  PaginatedProvider,
  PaginatedProviderInput,
  paginatedProviderPrisma
} from './paginatedProvider';
import { PaginatedList } from './types';

export interface PaginatorInput {
  limit?: number | string;
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
            description: 'Maximum number of items to return (1-100)',
            modifiers: [v.minValue(1), v.maxValue(100)]
          })
        ),
        after: v.optional(v.string(), { description: 'Return items after this ID' }),
        before: v.optional(v.string(), { description: 'Return items before this ID' }),
        cursor: v.optional(v.string(), {
          description: 'Pagination cursor from a previous response'
        }),
        order: v.optional(v.enumOf(['asc', 'desc']), { description: 'Sort order for results' })
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
    presenter: (item: T) => (context: PresenterContext) => { run: (d: any) => R } | undefined
  ) {
    return (context: PresenterContext) => ({
      run: async () => ({
        __typename: `list`,
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
      __typename: `list`,
      items: (await Promise.all(list.items.map(item => presenter(item)))).filter(Boolean),
      pagination: {
        has_more_after: list.pagination.hasNextPage,
        has_more_before: list.pagination.hasPreviousPage
      }
    };
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
      prisma: paginatedProviderPrisma
    });

    return await provider(providerInput);
  }
}
