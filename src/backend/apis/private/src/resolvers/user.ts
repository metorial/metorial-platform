import { Ctx, Query, Resolver, UseMiddleware } from 'type-graphql';
import { DUser } from '../objects/user';
import type { DContext } from '../utils/context';
import { ErrorInterceptor } from '../utils/error';

@Resolver(() => DUser)
export class UserResolver {
  @Query(() => DUser)
  @UseMiddleware(ErrorInterceptor)
  async me(@Ctx() ctx: DContext): Promise<DUser | undefined> {
    return DUser.fromUser(ctx.auth.user);
  }
}
