import { v, ValidationType } from '@metorial/validation';
import { Cursor } from './cursor';
import {
  PaginatedProvider,
  PaginatedProviderInput,
  paginatedProviderPrisma
} from './paginatedProvider';

export interface PaginatorInput {
  limit?: number;
  after?: string;
  before?: string;
  cursor?: string;
  order: 'asc' | 'desc';
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

  async validator<Inner extends object>(inner: ValidationType<Inner>) {
    return v.intersection([
      v.object({
        limit: v.optional(
          v.number({
            modifiers: [v.minValue(1), v.maxValue(this.opts.defaultLimit ?? 100)]
          })
        ),
        after: v.optional(v.string()),
        before: v.optional(v.string()),
        cursor: v.optional(v.string()),
        order: v.enumOf(['asc', 'desc'])
      }),
      inner
    ]);
  }

  async run(input: PaginatorInput) {
    let providerInput: PaginatedProviderInput = {
      limit: input.limit ?? this.opts.defaultLimit ?? 20,
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

    let items = await provider(providerInput);

    return items;
  }
}
