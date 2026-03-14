import { EntityImage, getImageUrl } from './getImageUrl';

export type GetOrganizationBrandParams = {
  id: string;
  name: string;
  image: EntityImage | null;
};

export let getOrganizationBrand = async (organization: GetOrganizationBrandParams) => ({
  name: organization.name,
  image: await getImageUrl(organization)
});
