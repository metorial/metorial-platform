import { Organization, User } from '@metorial/db';
import { shadowId } from '@metorial/shadow-id';
import 'reflect-metadata';
import { Field, ID, ObjectType } from 'type-graphql';
import { DOrganization } from './organization';

@ObjectType()
export class DFlag {
  @Field(() => ID)
  id: string;

  @Field()
  slug: string;

  @Field()
  value: boolean;
}

@ObjectType()
export class DFlags {
  @Field(() => [DFlag])
  flags: DFlag[];

  @Field()
  target: string;

  @Field(() => DOrganization)
  organization: DOrganization;

  static async of(d: {
    flags: {
      id?: string;
      slug: string;
      value: boolean;
    }[];
    user: User;
    organization: Organization;
  }) {
    let res = new DFlags();

    res.flags =
      d.flags?.map(flag => ({
        id: flag.id ?? shadowId('oflag_', [d.organization.id, d.user.id], [flag.slug]),
        slug: flag.slug,
        value: flag.value
      })) || [];
    res.organization = await DOrganization.fromOrg(d.organization);
    res.target = 'organization';

    return res;
  }
}
