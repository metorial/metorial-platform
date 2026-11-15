import { resourceSet } from '../../_lib/resource';
import { instanceResource } from './instance';
import { organizationResource } from './organization';
import { projectResource } from './project';

export let coreResources = resourceSet({
  instance: instanceResource,
  organization: organizationResource,
  project: projectResource
});
