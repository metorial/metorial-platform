import { getImageUrl, Organization } from '@metorial/db';

export class DOrganization {
  id: string;
  status: string;
  type: string;
  name: string;
  slug: string;
  imageUrl: string;
  createdAt: Date;
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
