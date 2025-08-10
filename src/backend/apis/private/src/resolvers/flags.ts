import { Ctx, Query, Resolver, UseMiddleware } from 'type-graphql';
import { DFlags } from '../objects/flags';
import type { DContext } from '../utils/context';
import { ErrorInterceptor } from '../utils/error';

@Resolver(() => DFlags)
export class FlagsResolver {
  @Query(() => DFlags)
  @UseMiddleware(ErrorInterceptor)
  async getFlags(@Ctx() ctx: DContext): Promise<DFlags | undefined> {
    return DFlags.of({
      flags: [],
      user: ctx.auth.user,
      organization: ctx.organization
    });
  }
}
