import { Ctx, Query, Resolver, UseMiddleware } from 'type-graphql';
import { DOrganization } from '../objects/organization';
import type { DContext } from '../utils/context';
import { ErrorInterceptor } from '../utils/error';

@Resolver(() => DOrganization)
export class OrganizationResolver {
  @Query(() => DOrganization)
  @UseMiddleware(ErrorInterceptor)
  async getOrganization(@Ctx() ctx: DContext): Promise<DOrganization | undefined> {
    return DOrganization.fromOrg(ctx.organization);
  }
}
