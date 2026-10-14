import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type OrganizationsFlagsGetOutput = {
  object: 'flags';
  flags: { slug: string; value: boolean }[];
};

export let mapOrganizationsFlagsGetOutput =
  /* @__PURE__ */ createMapper<OrganizationsFlagsGetOutput>(0);

export type OrganizationsFlagsGetQuery = { projectId?: string | undefined };

export let mapOrganizationsFlagsGetQuery =
  /* @__PURE__ */ mapObject<OrganizationsFlagsGetQuery>(['project_id']);
