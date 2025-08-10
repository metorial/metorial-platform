import { getImageUrl, User } from '@metorial/db';
import 'reflect-metadata';
import { Field, ID, ObjectType } from 'type-graphql';

@ObjectType()
export class DUser {
  @Field(() => ID)
  id: string;

  @Field()
  status: string;

  @Field()
  type: string;

  @Field()
  email: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  firstName?: string | null;

  @Field({ nullable: true })
  lastName?: string | null;

  @Field()
  imageUrl: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  static async fromUser(user: User): Promise<DUser> {
    let dUser = new DUser();

    dUser.id = user.id;
    dUser.status = user.status;
    dUser.type = user.type;
    dUser.email = user.email;
    dUser.name = user.name;
    dUser.firstName = user.firstName;
    dUser.lastName = user.lastName;
    dUser.imageUrl = await getImageUrl(user);
    dUser.createdAt = user.createdAt;
    dUser.updatedAt = user.updatedAt;

    return dUser;
  }
}
