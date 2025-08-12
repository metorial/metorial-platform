import { Organization, User } from '@metorial/db';
import { shadowId } from '@metorial/shadow-id';
import { DOrganization } from './organization';

export class DFlag {
  id: string;
  slug: string;
  value: boolean;
}

export class DFlags {
  flags: DFlag[];
  target: string;
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
