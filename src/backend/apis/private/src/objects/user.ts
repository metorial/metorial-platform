import { getImageUrl, User } from '@metorial/db';

export class DUser {
  id: string;
  status: string;
  type: string;
  email: string;
  name: string;
  firstName?: string | null;
  lastName?: string | null;
  imageUrl: string;
  createdAt: Date;
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
