import { MetorialSDKError } from '@metorial/util-endpoint';
import { useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useBoot } from './loaders/boot';
import { useInstance, useInstances } from './loaders/instance';
import { useOrganization } from './loaders/organization';
import { useProject, useProjects } from './loaders/project';

let orgNotFound = new MetorialSDKError({
  status: 404,
  code: 'not_found',
  message: 'Organization not found'
});

let projectNotFound = new MetorialSDKError({
  status: 404,
  code: 'not_found',
  message: 'Project not found'
});

let instanceNotFound = new MetorialSDKError({
  status: 404,
  code: 'not_found',
  message: 'Instance not found'
});

export let useCurrentOrganization = () => {
  let boot = useBoot();

  let params = useParams<{ organizationId: string; projectId: string; instanceId: string }>();
  let [search] = useSearchParams();

  let organizationId =
    params.organizationId || search.get('organizationId') || search.get('organization_id');
  let projectId = params.projectId || search.get('projectId') || search.get('project_id');
  let instanceId = params.instanceId || search.get('instanceId') || search.get('instance_id');

  let foundItem = useMemo(() => {
    // return orgs.data?.find(org => org.id == organizationId || org.slug == organizationId);

    if (instanceId) {
      let instance = boot.data?.instances.find(
        instance => instance.id == instanceId || instance.slug == instanceId
      );
      if (instance) {
        let org = boot.data?.organizations.find(org => org.id == instance.organizationId);
        if (org) {
          return {
            type: 'instance' as const,
            instance,
            project: instance.project,
            organization: org
          };
        }
      }
    }

    if (projectId) {
      let project = boot.data?.projects.find(
        project => project.id == projectId || project.slug == projectId
      );
      if (project) {
        let org = boot.data?.organizations.find(org => org.id == project.organizationId);
        if (org) {
          return {
            type: 'project' as const,
            project,
            organization: org
          };
        }
      }
    }

    if (organizationId) {
      let org = boot.data?.organizations.find(
        org => org.id == organizationId || org.slug == organizationId
      );
      if (org) {
        return {
          type: 'organization' as const,
          organization: org
        };
      }
    }

    return null;
  }, [boot.data, organizationId, projectId, instanceId]);

  let org = useOrganization(foundItem?.organization.id);

  if (!foundItem && boot.data && (organizationId || projectId || instanceId)) {
    return {
      ...boot,
      ...org,
      data: null,
      error: orgNotFound,
      isLoading: false
    };
  }

  let instanceOk =
    foundItem?.type != 'instance' ||
    ((!projectId ||
      foundItem?.project.id == projectId ||
      foundItem?.project.slug == projectId) &&
      (!instanceId ||
        foundItem?.instance.id == instanceId ||
        foundItem?.instance.slug == instanceId) &&
      (!organizationId ||
        foundItem?.organization.id == organizationId ||
        foundItem?.organization.slug == organizationId));

  let projectOk =
    foundItem?.type != 'project' ||
    ((!projectId ||
      foundItem?.project.id == projectId ||
      foundItem?.project.slug == projectId) &&
      (!organizationId ||
        foundItem?.organization.id == organizationId ||
        foundItem?.organization.slug == organizationId));

  if (foundItem && (!instanceOk || !projectOk)) {
    return {
      ...boot,
      ...org,
      data: null,
      error: orgNotFound,
      isLoading: false
    };
  }

  if (boot.error || !boot.data) {
    return {
      ...boot,
      ...org,
      data: null,
      error: boot.error,
      isLoading: boot.isLoading
    };
  }

  if (!foundItem) {
    return {
      ...boot,
      ...org,
      data: null,
      error: orgNotFound,
      isLoading: false
    };
  }

  let instances = boot.data.instances.filter(
    instance => instance.organizationId == foundItem.organization.id
  );
  let projects = boot.data.projects
    .filter(project => project.organizationId == foundItem.organization.id)
    .map(project => {
      let projectInstances = instances.filter(instance => instance.project.id == project.id);
      return {
        ...project,
        instances: projectInstances
      };
    });

  return {
    ...boot,
    ...org,
    data: {
      ...foundItem.organization,
      projects,
      instances,

      currentProject: 'project' in foundItem ? foundItem.project : null,
      currentInstance: 'instance' in foundItem ? foundItem.instance : null
    },
    error: null,
    isLoading: false
  };
};

export let useCurrentProject = () => {
  let org = useCurrentOrganization();
  let project = useProject(org.data?.id, org.data?.currentProject?.id);

  if (org.error || !org.data) {
    return {
      ...org,
      ...project,
      data: null,
      error: org.error,
      isLoading: org.isLoading
    };
  }

  if (!org.data.currentProject) {
    return {
      ...org,
      ...project,
      data: null,
      error: projectNotFound,
      isLoading: false
    };
  }

  return {
    ...org,
    ...project,
    data: {
      ...org.data.currentProject,
      organization: org.data,
      instances: org.data.instances.filter(
        instance => instance.project.id == org.data.currentProject!.id
      )
    },
    error: org.error,
    isLoading: org.isLoading
  };
};

export let useCurrentInstance = () => {
  let org = useCurrentOrganization();
  let instance = useInstance(org.data?.id, org.data?.currentInstance?.id);

  if (org.error || !org.data) {
    return {
      ...org,
      ...instance,
      data: null,
      error: org.error,
      isLoading: org.isLoading
    };
  }

  if (!org.data.currentInstance) {
    return {
      ...org,
      ...instance,
      data: null,
      error: instanceNotFound,
      isLoading: false
    };
  }

  return {
    ...org,
    ...instance,
    data: {
      ...org.data.currentInstance,
      organization: org.data
    },
    error: org.error,
    isLoading: org.isLoading
  };
};

export let useCurrentProjects = () => {
  let org = useCurrentOrganization();
  return useProjects(org.data?.id);
};

export let useCurrentInstances = () => {
  let org = useCurrentProject();
  return useInstances(org.data?.id);
};
