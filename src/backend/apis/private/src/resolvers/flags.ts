import { flagService } from '@metorial/module-flags';
import { Ctx, Query, Resolver, UseMiddleware } from 'type-graphql';
import { DFlags } from '../objects/flags';
import type { DContext } from '../utils/context';
import { ErrorInterceptor } from '../utils/error';

@Resolver(() => DFlags)
export class FlagsResolver {
  @Query(() => DFlags)
  @UseMiddleware(ErrorInterceptor)
  async getFlags(@Ctx() ctx: DContext): Promise<DFlags | undefined> {
    let flags = await flagService.getFlags({
      organization: ctx.organization,
      user: ctx.auth.user
    });

    return DFlags.of({
      flags: Object.entries(flags).map(([slug, value]) => ({
        slug,
        value
      })),
      user: ctx.auth.user,
      organization: ctx.organization
    });
  }
}
