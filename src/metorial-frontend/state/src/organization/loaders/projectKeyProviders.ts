import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';
import { projectLoader } from './project';

export let projectKeyProvidersLoader = createLoader({
  name: 'projectKeyProviders',
  parents: [projectLoader],
  fetch: (i: {
    organizationId: string;
    projectId: string;
    before?: string;
    after?: string;
  }) =>
    withAuth(sdk =>
      sdk.projects.keyProviders.list(i.organizationId, i.projectId, {
        before: i.before,
        after: i.after,
        limit: 100
      })
    ),
  mutators: {
    createManaged: (
      i: { name: string },
      { input }: { input: { organizationId: string; projectId: string } }
    ) =>
      withAuth(sdk =>
        sdk.projects.keyProviders.createManaged(input.organizationId, input.projectId, i)
      ),
    import: (
      i: { keyInput: Record<string, unknown> },
      { input }: { input: { organizationId: string; projectId: string } }
    ) =>
      withAuth(sdk =>
        sdk.projects.keyProviders.import(input.organizationId, input.projectId, i)
      )
  }
});

export let useProjectKeyProviders = (
  organizationId: string | null | undefined,
  projectId: string | null | undefined
) => {
  let keyProviders = usePaginator(cursor =>
    projectKeyProvidersLoader.use(
      organizationId && projectId ? { organizationId, projectId, ...cursor } : null
    )
  );

  return {
    ...keyProviders,
    createManagedMutator: keyProviders.useMutator('createManaged'),
    importMutator: keyProviders.useMutator('import')
  };
};

export let projectKeyProviderLoader = createLoader({
  name: 'projectKeyProvider',
  parents: [projectKeyProvidersLoader],
  fetch: (i: { organizationId: string; projectId: string; keyProviderId: string }) =>
    withAuth(sdk =>
      sdk.projects.keyProviders.get(i.organizationId, i.projectId, i.keyProviderId)
    ),
  mutators: {
    validate: (_: {}, { input }: { input: { organizationId: string; projectId: string; keyProviderId: string } }) =>
      withAuth(sdk =>
        sdk.projects.keyProviders.validate(
          input.organizationId,
          input.projectId,
          input.keyProviderId
        )
      ),
    setDefault: (_: {}, { input }: { input: { organizationId: string; projectId: string; keyProviderId: string } }) =>
      withAuth(sdk =>
        sdk.projects.keyProviders.setDefault(
          input.organizationId,
          input.projectId,
          input.keyProviderId
        )
      )
  }
});

export let useProjectKeyProvider = (
  organizationId: string | null | undefined,
  projectId: string | null | undefined,
  keyProviderId: string | null | undefined
) => {
  let keyProvider = projectKeyProviderLoader.use(
    organizationId && projectId && keyProviderId
      ? { organizationId, projectId, keyProviderId }
      : null
  );

  return {
    ...keyProvider,
    validateMutator: keyProvider.useMutator('validate'),
    setDefaultMutator: keyProvider.useMutator('setDefault')
  };
};

export let projectKeyProviderErrorsLoader = createLoader({
  name: 'projectKeyProviderErrors',
  parents: [projectKeyProviderLoader],
  fetch: (i: {
    organizationId: string;
    projectId: string;
    keyProviderId: string;
    before?: string;
    after?: string;
  }) =>
    withAuth(sdk =>
      sdk.projects.keyProviders.errors.list(
        i.organizationId,
        i.projectId,
        i.keyProviderId,
        {
          before: i.before,
          after: i.after,
          limit: 100
        }
      )
    ),
  mutators: {}
});

export let useProjectKeyProviderErrors = (
  organizationId: string | null | undefined,
  projectId: string | null | undefined,
  keyProviderId: string | null | undefined
) => {
  return usePaginator(cursor =>
    projectKeyProviderErrorsLoader.use(
      organizationId && projectId && keyProviderId
        ? { organizationId, projectId, keyProviderId, ...cursor }
        : null
    )
  );
};

export let projectKeyProviderSetupInfoLoader = createLoader({
  name: 'projectKeyProviderSetupInfo',
  parents: [projectLoader],
  fetch: (i: {
    organizationId: string;
    projectId: string;
    region?: string;
    keyId?: string;
  }) =>
    withAuth(sdk =>
      sdk.projects.keyProviders.getSetupInfo(i.organizationId, i.projectId, '_', {
        region: i.region,
        keyId: i.keyId
      })
    ),
  mutators: {}
});

export let useProjectKeyProviderSetupInfo = (
  organizationId: string | null | undefined,
  projectId: string | null | undefined,
  query?: { region?: string; keyId?: string } | null
) => {
  return projectKeyProviderSetupInfoLoader.use(
    organizationId && projectId
      ? {
          organizationId,
          projectId,
          region: query?.region,
          keyId: query?.keyId
        }
      : null
  );
};
