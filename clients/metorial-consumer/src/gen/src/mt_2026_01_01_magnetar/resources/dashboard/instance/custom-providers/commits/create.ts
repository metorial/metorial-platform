import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceCustomProvidersCommitsCreateOutput = {
  object: 'custom_provider.commit';
  id: string;
  status: string | null;
  trigger: string | null;
  error: { code: string; message: string } | null;
  customProviderId: string;
  providerId: string | null;
  customProviderDeploymentId: string | null;
  toEnvironment: {
    object: 'custom_provider.environment';
    id: string;
    customProviderId: string;
    providerId: string | null;
    currentProviderVersionId: string | null;
    instanceId: string | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  fromEnvironment: {
    object: 'custom_provider.environment';
    id: string;
    customProviderId: string;
    providerId: string | null;
    currentProviderVersionId: string | null;
    instanceId: string | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  targetCustomProviderVersion: {
    object: 'custom_provider.version';
    id: string;
    status: string | null;
    index: number | null;
    identifier: string | null;
    deployment: {
      object: 'custom_provider.deployment';
      id: string;
      status: string | null;
      trigger: string | null;
      customProviderId: string;
      providerId: string | null;
      customProviderVersionId: string | null;
      commit: {
        id: string;
        type: string | null;
        message: string | null;
        createdAt: Date;
      } | null;
      actor: {
        id: string;
        name: string | null;
        type: string | null;
        organizationActorId: string | null;
      } | null;
      createdAt: Date;
      updatedAt: Date;
    } | null;
    environments: {
      object: 'custom_provider.environment';
      id: string;
      isCurrentVersionForEnvironment: boolean | null;
      environment: {
        object: 'custom_provider.environment';
        id: string;
        customProviderId: string;
        providerId: string | null;
        currentProviderVersionId: string | null;
        instanceId: string | null;
        createdAt: Date;
        updatedAt: Date;
      };
    }[];
    customProviderId: string;
    providerId: string | null;
    actor: {
      id: string;
      name: string | null;
      type: string | null;
      organizationActorId: string | null;
    } | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  previousCustomProviderVersion: {
    object: 'custom_provider.version';
    id: string;
    status: string | null;
    index: number | null;
    identifier: string | null;
    deployment: {
      object: 'custom_provider.deployment';
      id: string;
      status: string | null;
      trigger: string | null;
      customProviderId: string;
      providerId: string | null;
      customProviderVersionId: string | null;
      commit: {
        id: string;
        type: string | null;
        message: string | null;
        createdAt: Date;
      } | null;
      actor: {
        id: string;
        name: string | null;
        type: string | null;
        organizationActorId: string | null;
      } | null;
      createdAt: Date;
      updatedAt: Date;
    } | null;
    environments: {
      object: 'custom_provider.environment';
      id: string;
      isCurrentVersionForEnvironment: boolean | null;
      environment: {
        object: 'custom_provider.environment';
        id: string;
        customProviderId: string;
        providerId: string | null;
        currentProviderVersionId: string | null;
        instanceId: string | null;
        createdAt: Date;
        updatedAt: Date;
      };
    }[];
    customProviderId: string;
    providerId: string | null;
    actor: {
      id: string;
      name: string | null;
      type: string | null;
      organizationActorId: string | null;
    } | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  actor: {
    id: string;
    name: string | null;
    type: string | null;
    organizationActorId: string | null;
  } | null;
  createdAt: Date;
  appliedAt: Date | null;
};

export let mapDashboardInstanceCustomProvidersCommitsCreateOutput =
  mtMap.object<DashboardInstanceCustomProvidersCommitsCreateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    trigger: mtMap.objectField('trigger', mtMap.passthrough()),
    error: mtMap.objectField(
      'error',
      mtMap.object({
        code: mtMap.objectField('code', mtMap.passthrough()),
        message: mtMap.objectField('message', mtMap.passthrough())
      })
    ),
    customProviderId: mtMap.objectField(
      'custom_provider_id',
      mtMap.passthrough()
    ),
    providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
    customProviderDeploymentId: mtMap.objectField(
      'custom_provider_deployment_id',
      mtMap.passthrough()
    ),
    toEnvironment: mtMap.objectField(
      'to_environment',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        customProviderId: mtMap.objectField(
          'custom_provider_id',
          mtMap.passthrough()
        ),
        providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
        currentProviderVersionId: mtMap.objectField(
          'current_provider_version_id',
          mtMap.passthrough()
        ),
        instanceId: mtMap.objectField('instance_id', mtMap.passthrough()),
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        updatedAt: mtMap.objectField('updated_at', mtMap.date())
      })
    ),
    fromEnvironment: mtMap.objectField(
      'from_environment',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        customProviderId: mtMap.objectField(
          'custom_provider_id',
          mtMap.passthrough()
        ),
        providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
        currentProviderVersionId: mtMap.objectField(
          'current_provider_version_id',
          mtMap.passthrough()
        ),
        instanceId: mtMap.objectField('instance_id', mtMap.passthrough()),
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        updatedAt: mtMap.objectField('updated_at', mtMap.date())
      })
    ),
    targetCustomProviderVersion: mtMap.objectField(
      'target_custom_provider_version',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        status: mtMap.objectField('status', mtMap.passthrough()),
        index: mtMap.objectField('index', mtMap.passthrough()),
        identifier: mtMap.objectField('identifier', mtMap.passthrough()),
        deployment: mtMap.objectField(
          'deployment',
          mtMap.object({
            object: mtMap.objectField('object', mtMap.passthrough()),
            id: mtMap.objectField('id', mtMap.passthrough()),
            status: mtMap.objectField('status', mtMap.passthrough()),
            trigger: mtMap.objectField('trigger', mtMap.passthrough()),
            customProviderId: mtMap.objectField(
              'custom_provider_id',
              mtMap.passthrough()
            ),
            providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
            customProviderVersionId: mtMap.objectField(
              'custom_provider_version_id',
              mtMap.passthrough()
            ),
            commit: mtMap.objectField(
              'commit',
              mtMap.object({
                id: mtMap.objectField('id', mtMap.passthrough()),
                type: mtMap.objectField('type', mtMap.passthrough()),
                message: mtMap.objectField('message', mtMap.passthrough()),
                createdAt: mtMap.objectField('created_at', mtMap.date())
              })
            ),
            actor: mtMap.objectField(
              'actor',
              mtMap.object({
                id: mtMap.objectField('id', mtMap.passthrough()),
                name: mtMap.objectField('name', mtMap.passthrough()),
                type: mtMap.objectField('type', mtMap.passthrough()),
                organizationActorId: mtMap.objectField(
                  'organization_actor_id',
                  mtMap.passthrough()
                )
              })
            ),
            createdAt: mtMap.objectField('created_at', mtMap.date()),
            updatedAt: mtMap.objectField('updated_at', mtMap.date())
          })
        ),
        environments: mtMap.objectField(
          'environments',
          mtMap.array(
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              isCurrentVersionForEnvironment: mtMap.objectField(
                'is_current_version_for_environment',
                mtMap.passthrough()
              ),
              environment: mtMap.objectField(
                'environment',
                mtMap.object({
                  object: mtMap.objectField('object', mtMap.passthrough()),
                  id: mtMap.objectField('id', mtMap.passthrough()),
                  customProviderId: mtMap.objectField(
                    'custom_provider_id',
                    mtMap.passthrough()
                  ),
                  providerId: mtMap.objectField(
                    'provider_id',
                    mtMap.passthrough()
                  ),
                  currentProviderVersionId: mtMap.objectField(
                    'current_provider_version_id',
                    mtMap.passthrough()
                  ),
                  instanceId: mtMap.objectField(
                    'instance_id',
                    mtMap.passthrough()
                  ),
                  createdAt: mtMap.objectField('created_at', mtMap.date()),
                  updatedAt: mtMap.objectField('updated_at', mtMap.date())
                })
              )
            })
          )
        ),
        customProviderId: mtMap.objectField(
          'custom_provider_id',
          mtMap.passthrough()
        ),
        providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
        actor: mtMap.objectField(
          'actor',
          mtMap.object({
            id: mtMap.objectField('id', mtMap.passthrough()),
            name: mtMap.objectField('name', mtMap.passthrough()),
            type: mtMap.objectField('type', mtMap.passthrough()),
            organizationActorId: mtMap.objectField(
              'organization_actor_id',
              mtMap.passthrough()
            )
          })
        ),
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        updatedAt: mtMap.objectField('updated_at', mtMap.date())
      })
    ),
    previousCustomProviderVersion: mtMap.objectField(
      'previous_custom_provider_version',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        status: mtMap.objectField('status', mtMap.passthrough()),
        index: mtMap.objectField('index', mtMap.passthrough()),
        identifier: mtMap.objectField('identifier', mtMap.passthrough()),
        deployment: mtMap.objectField(
          'deployment',
          mtMap.object({
            object: mtMap.objectField('object', mtMap.passthrough()),
            id: mtMap.objectField('id', mtMap.passthrough()),
            status: mtMap.objectField('status', mtMap.passthrough()),
            trigger: mtMap.objectField('trigger', mtMap.passthrough()),
            customProviderId: mtMap.objectField(
              'custom_provider_id',
              mtMap.passthrough()
            ),
            providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
            customProviderVersionId: mtMap.objectField(
              'custom_provider_version_id',
              mtMap.passthrough()
            ),
            commit: mtMap.objectField(
              'commit',
              mtMap.object({
                id: mtMap.objectField('id', mtMap.passthrough()),
                type: mtMap.objectField('type', mtMap.passthrough()),
                message: mtMap.objectField('message', mtMap.passthrough()),
                createdAt: mtMap.objectField('created_at', mtMap.date())
              })
            ),
            actor: mtMap.objectField(
              'actor',
              mtMap.object({
                id: mtMap.objectField('id', mtMap.passthrough()),
                name: mtMap.objectField('name', mtMap.passthrough()),
                type: mtMap.objectField('type', mtMap.passthrough()),
                organizationActorId: mtMap.objectField(
                  'organization_actor_id',
                  mtMap.passthrough()
                )
              })
            ),
            createdAt: mtMap.objectField('created_at', mtMap.date()),
            updatedAt: mtMap.objectField('updated_at', mtMap.date())
          })
        ),
        environments: mtMap.objectField(
          'environments',
          mtMap.array(
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              isCurrentVersionForEnvironment: mtMap.objectField(
                'is_current_version_for_environment',
                mtMap.passthrough()
              ),
              environment: mtMap.objectField(
                'environment',
                mtMap.object({
                  object: mtMap.objectField('object', mtMap.passthrough()),
                  id: mtMap.objectField('id', mtMap.passthrough()),
                  customProviderId: mtMap.objectField(
                    'custom_provider_id',
                    mtMap.passthrough()
                  ),
                  providerId: mtMap.objectField(
                    'provider_id',
                    mtMap.passthrough()
                  ),
                  currentProviderVersionId: mtMap.objectField(
                    'current_provider_version_id',
                    mtMap.passthrough()
                  ),
                  instanceId: mtMap.objectField(
                    'instance_id',
                    mtMap.passthrough()
                  ),
                  createdAt: mtMap.objectField('created_at', mtMap.date()),
                  updatedAt: mtMap.objectField('updated_at', mtMap.date())
                })
              )
            })
          )
        ),
        customProviderId: mtMap.objectField(
          'custom_provider_id',
          mtMap.passthrough()
        ),
        providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
        actor: mtMap.objectField(
          'actor',
          mtMap.object({
            id: mtMap.objectField('id', mtMap.passthrough()),
            name: mtMap.objectField('name', mtMap.passthrough()),
            type: mtMap.objectField('type', mtMap.passthrough()),
            organizationActorId: mtMap.objectField(
              'organization_actor_id',
              mtMap.passthrough()
            )
          })
        ),
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        updatedAt: mtMap.objectField('updated_at', mtMap.date())
      })
    ),
    actor: mtMap.objectField(
      'actor',
      mtMap.object({
        id: mtMap.objectField('id', mtMap.passthrough()),
        name: mtMap.objectField('name', mtMap.passthrough()),
        type: mtMap.objectField('type', mtMap.passthrough()),
        organizationActorId: mtMap.objectField(
          'organization_actor_id',
          mtMap.passthrough()
        )
      })
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    appliedAt: mtMap.objectField('applied_at', mtMap.date())
  });

export type DashboardInstanceCustomProvidersCommitsCreateBody = {
  message: string;
  action:
    | {
        type: 'merge_version_into_environment';
        fromEnvironmentId: string;
        toEnvironmentId: string;
      }
    | { type: 'rollback_commit'; environmentId: string; versionId: string };
};

export let mapDashboardInstanceCustomProvidersCommitsCreateBody =
  mtMap.object<DashboardInstanceCustomProvidersCommitsCreateBody>({
    message: mtMap.objectField('message', mtMap.passthrough()),
    action: mtMap.objectField(
      'action',
      mtMap.union([
        mtMap.unionOption(
          'object',
          mtMap.object({
            type: mtMap.objectField('type', mtMap.passthrough()),
            fromEnvironmentId: mtMap.objectField(
              'from_environment_id',
              mtMap.passthrough()
            ),
            toEnvironmentId: mtMap.objectField(
              'to_environment_id',
              mtMap.passthrough()
            ),
            environmentId: mtMap.objectField(
              'environment_id',
              mtMap.passthrough()
            ),
            versionId: mtMap.objectField('version_id', mtMap.passthrough())
          })
        )
      ])
    )
  });

