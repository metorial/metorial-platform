import { getImageUrl, Organization } from '@metorial/db';
import 'reflect-metadata';
import { Field, ID, ObjectType } from 'type-graphql';

// id  String @unique

// type   OrganizationType
// status OrganizationStatus

// slug String @unique
// name String

// /// [EntityImage]
// image Json

// deletedAt DateTime?
// createdAt DateTime  @default(now())
// updatedAt DateTime  @default(now()) @updatedAt

@ObjectType()
export class DOrganization {
  @Field(() => ID)
  id: string;

  @Field()
  status: string;

  @Field()
  type: string;

  @Field()
  name: string;

  @Field()
  slug: string;

  @Field()
  imageUrl: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  static async fromOrg(org: Organization): Promise<DOrganization> {
    let res = new DOrganization();

    res.id = org.id;
    res.status = org.status;
    res.type = org.type;
    res.name = org.name;
    res.slug = org.slug;
    res.imageUrl = await getImageUrl(org);
    res.createdAt = org.createdAt;
    res.updatedAt = org.updatedAt;

    return res;
  }
}
