import { badRequestError, ServiceError } from '@lowerdeck/error';
import { db, type Environment, type Solution, type Tenant } from '@metorial-subspace/db';

type TenantScope = {
  tenant: Tenant;
  solution: Solution;
  environment: Environment;
};

let activeIntegrationInstanceProviderWhere = (d: TenantScope) => ({
  tenantOid: d.tenant.oid,
  solutionOid: d.solution.oid,
  environmentOid: d.environment.oid,
  status: 'active' as const,
  isParentDeleted: false,
  integrationInstance: {
    status: { in: ['draft' as const, 'active' as const] },
    isParentDeleted: false,
    integration: {
      status: 'active' as const
    }
  }
});

let throwIntegrationInstanceProviderLinkError = (d: {
  resourceLabel: string;
  resourceId: string;
  code: string;
  integrationInstanceProvider: {
    id: string;
    name: string | null;
    integrationInstance: { id: string; name: string | null };
  };
}) => {
  throw new ServiceError(
    badRequestError({
      message: `${d.resourceLabel} is linked to an active integration instance provider and cannot be archived directly.`,
      code: d.code,
      data: {
        id: d.resourceId,
        integrationInstanceProviderId: d.integrationInstanceProvider.id,
        integrationInstanceProviderName: d.integrationInstanceProvider.name,
        integrationInstanceId: d.integrationInstanceProvider.integrationInstance.id,
        integrationInstanceName: d.integrationInstanceProvider.integrationInstance.name
      }
    })
  );
};

export let assertNoActiveIntegrationInstanceProviderConfigLink = async (
  d: TenantScope & { configOid: bigint; resourceId: string }
) => {
  let integrationInstanceProvider = await db.integrationInstanceProvider.findFirst({
    where: {
      ...activeIntegrationInstanceProviderWhere(d),
      currentVersion: {
        configOid: d.configOid
      }
    },
    select: {
      id: true,
      name: true,
      integrationInstance: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });
  if (!integrationInstanceProvider) return;

  throwIntegrationInstanceProviderLinkError({
    resourceLabel: 'Provider config',
    resourceId: d.resourceId,
    code: 'provider_config_integration_instance_provider_archive_not_allowed',
    integrationInstanceProvider
  });
};

export let assertNoActiveIntegrationInstanceProviderAuthConfigLink = async (
  d: TenantScope & { authConfigOid: bigint; resourceId: string }
) => {
  let integrationInstanceProvider = await db.integrationInstanceProvider.findFirst({
    where: {
      ...activeIntegrationInstanceProviderWhere(d),
      currentVersion: {
        authConfigOid: d.authConfigOid
      }
    },
    select: {
      id: true,
      name: true,
      integrationInstance: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });
  if (!integrationInstanceProvider) return;

  throwIntegrationInstanceProviderLinkError({
    resourceLabel: 'Provider auth config',
    resourceId: d.resourceId,
    code: 'provider_auth_config_integration_instance_provider_archive_not_allowed',
    integrationInstanceProvider
  });
};

export let assertNoActiveIntegrationInstanceProviderDeploymentLink = async (
  d: TenantScope & { deploymentOid: bigint; resourceId: string }
) => {
  let integrationInstanceProvider = await db.integrationInstanceProvider.findFirst({
    where: {
      ...activeIntegrationInstanceProviderWhere(d),
      currentVersion: {
        integrationProviderVersion: {
          deploymentOid: d.deploymentOid
        }
      }
    },
    select: {
      id: true,
      name: true,
      integrationInstance: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });
  if (!integrationInstanceProvider) return;

  throwIntegrationInstanceProviderLinkError({
    resourceLabel: 'Provider deployment',
    resourceId: d.resourceId,
    code: 'provider_deployment_integration_instance_provider_archive_not_allowed',
    integrationInstanceProvider
  });
};

export let assertNoActiveIntegrationInstanceProviderAuthCredentialsLink = async (
  d: TenantScope & { authCredentialsOid: bigint; resourceId: string }
) => {
  let integrationInstanceProvider = await db.integrationInstanceProvider.findFirst({
    where: {
      ...activeIntegrationInstanceProviderWhere(d),
      currentVersion: {
        integrationProviderVersion: {
          authCredentialsOid: d.authCredentialsOid
        }
      }
    },
    select: {
      id: true,
      name: true,
      integrationInstance: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });
  if (!integrationInstanceProvider) return;

  throwIntegrationInstanceProviderLinkError({
    resourceLabel: 'Provider auth credentials',
    resourceId: d.resourceId,
    code: 'provider_auth_credentials_integration_instance_provider_archive_not_allowed',
    integrationInstanceProvider
  });
};

export let assertNoActiveIntegrationInstanceProviderAuthMethodLink = async (
  d: TenantScope & { authMethodOid: bigint; resourceId: string }
) => {
  let integrationInstanceProvider = await db.integrationInstanceProvider.findFirst({
    where: {
      ...activeIntegrationInstanceProviderWhere(d),
      currentVersion: {
        integrationProviderVersion: {
          authMethodOid: d.authMethodOid
        }
      }
    },
    select: {
      id: true,
      name: true,
      integrationInstance: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });
  if (!integrationInstanceProvider) return;

  throwIntegrationInstanceProviderLinkError({
    resourceLabel: 'Provider auth method',
    resourceId: d.resourceId,
    code: 'provider_auth_method_integration_instance_provider_archive_not_allowed',
    integrationInstanceProvider
  });
};

let throwIdentityCredentialLinkError = (d: {
  resourceLabel: string;
  resourceId: string;
  code: string;
  identityCredential: {
    id: string;
    identity: { id: string; name: string | null };
  };
}) => {
  throw new ServiceError(
    badRequestError({
      message: `${d.resourceLabel} is linked to an active identity credential and cannot be archived directly.`,
      code: d.code,
      data: {
        id: d.resourceId,
        identityCredentialId: d.identityCredential.id,
        identityId: d.identityCredential.identity.id,
        identityName: d.identityCredential.identity.name
      }
    })
  );
};

export let assertNoActiveIdentityCredentialConfigLink = async (
  d: TenantScope & { configOid: bigint; resourceId: string }
) => {
  let identityCredential = await db.identityCredential.findFirst({
    where: {
      status: 'active',
      configOid: d.configOid,
      identity: {
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid,
        status: 'active',
        isParentDeleted: false
      }
    },
    select: {
      id: true,
      identity: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });
  if (!identityCredential) return;

  throwIdentityCredentialLinkError({
    resourceLabel: 'Provider config',
    resourceId: d.resourceId,
    code: 'provider_config_identity_credential_archive_not_allowed',
    identityCredential
  });
};

export let assertNoActiveIdentityCredentialAuthConfigLink = async (
  d: TenantScope & { authConfigOid: bigint; resourceId: string }
) => {
  let identityCredential = await db.identityCredential.findFirst({
    where: {
      status: 'active',
      authConfigOid: d.authConfigOid,
      identity: {
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid,
        status: 'active',
        isParentDeleted: false
      }
    },
    select: {
      id: true,
      identity: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });
  if (!identityCredential) return;

  throwIdentityCredentialLinkError({
    resourceLabel: 'Provider auth config',
    resourceId: d.resourceId,
    code: 'provider_auth_config_identity_credential_archive_not_allowed',
    identityCredential
  });
};

export let assertNoActiveIdentityCredentialDeploymentLink = async (
  d: TenantScope & { deploymentOid: bigint; resourceId: string }
) => {
  let identityCredential = await db.identityCredential.findFirst({
    where: {
      status: 'active',
      deploymentOid: d.deploymentOid,
      identity: {
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid,
        status: 'active',
        isParentDeleted: false
      }
    },
    select: {
      id: true,
      identity: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });
  if (!identityCredential) return;

  throwIdentityCredentialLinkError({
    resourceLabel: 'Provider deployment',
    resourceId: d.resourceId,
    code: 'provider_deployment_identity_credential_archive_not_allowed',
    identityCredential
  });
};

export let assertNoActiveIntegrationIdentityLink = async (
  d: TenantScope & {
    identityOid: bigint;
    identityId: string;
    ownedByIntegrationInstanceOid?: bigint | null;
  }
) => {
  let activeIntegrationInstance = await db.integrationInstance.findFirst({
    where: {
      tenantOid: d.tenant.oid,
      solutionOid: d.solution.oid,
      environmentOid: d.environment.oid,
      status: 'active',
      OR: [
        { identityOid: d.identityOid },
        { oid: d.ownedByIntegrationInstanceOid ?? -1n }
      ]
    },
    select: {
      id: true,
      name: true
    }
  });
  if (activeIntegrationInstance) {
    throw new ServiceError(
      badRequestError({
        message:
          'Identity is linked to an active integration instance and cannot be deleted.',
        code: 'identity_in_use_by_active_integration_instance',
        data: {
          integrationInstanceId: activeIntegrationInstance.id,
          integrationInstanceName: activeIntegrationInstance.name
        }
      })
    );
  }

  let activeIntegrationInstanceGroup = await db.integrationInstanceGroup.findFirst({
    where: {
      tenantOid: d.tenant.oid,
      solutionOid: d.solution.oid,
      environmentOid: d.environment.oid,
      status: 'active',
      identityOid: d.identityOid
    },
    select: {
      id: true,
      name: true
    }
  });
  if (activeIntegrationInstanceGroup) {
    throw new ServiceError(
      badRequestError({
        message:
          'Identity is linked to an active integration instance group and cannot be deleted.',
        code: 'identity_in_use_by_active_integration_instance_group',
        data: {
          integrationInstanceGroupId: activeIntegrationInstanceGroup.id,
          integrationInstanceGroupName: activeIntegrationInstanceGroup.name
        }
      })
    );
  }
};

export let assertNoActiveIntegrationActorLink = async (
  d: TenantScope & { identityActorOid: bigint; identityActorId: string }
) => {
  let activeIntegrationInstance = await db.integrationInstance.findFirst({
    where: {
      tenantOid: d.tenant.oid,
      solutionOid: d.solution.oid,
      environmentOid: d.environment.oid,
      status: { in: ['draft', 'active'] },
      identityActorOid: d.identityActorOid
    },
    select: {
      id: true,
      name: true
    }
  });
  if (activeIntegrationInstance) {
    throw new ServiceError(
      badRequestError({
        message:
          'Identity actor is linked to an active integration instance and cannot be deleted.',
        code: 'identity_actor_in_use_by_active_integration_instance',
        data: {
          integrationInstanceId: activeIntegrationInstance.id,
          integrationInstanceName: activeIntegrationInstance.name
        }
      })
    );
  }

  let activeIntegrationInstanceGroup = await db.integrationInstanceGroup.findFirst({
    where: {
      tenantOid: d.tenant.oid,
      solutionOid: d.solution.oid,
      environmentOid: d.environment.oid,
      status: { in: ['draft', 'active'] },
      identityActorOid: d.identityActorOid
    },
    select: {
      id: true,
      name: true
    }
  });
  if (activeIntegrationInstanceGroup) {
    throw new ServiceError(
      badRequestError({
        message:
          'Identity actor is linked to an active integration instance group and cannot be deleted.',
        code: 'identity_actor_in_use_by_active_integration_instance_group',
        data: {
          integrationInstanceGroupId: activeIntegrationInstanceGroup.id,
          integrationInstanceGroupName: activeIntegrationInstanceGroup.name
        }
      })
    );
  }

  let magicMcpServerBacking = await db.magicMcpServerBacking.findFirst({
    where: {
      actorOid: d.identityActorOid,
      integrationInstance: {
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid
      }
    },
    select: {
      id: true
    }
  });
  if (magicMcpServerBacking) {
    throw new ServiceError(
      badRequestError({
        message:
          'Identity actor is linked to a magic MCP server backing and cannot be deleted.',
        code: 'identity_actor_in_use_by_magic_mcp_backing',
        data: {
          identityActorId: d.identityActorId,
          magicMcpServerBackingId: magicMcpServerBacking.id
        }
      })
    );
  }

  let magicMcpEndpointBacking = await db.magicMcpEndpointBacking.findFirst({
    where: {
      actorOid: d.identityActorOid,
      integrationGroup: {
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid
      }
    },
    select: {
      id: true
    }
  });
  if (magicMcpEndpointBacking) {
    throw new ServiceError(
      badRequestError({
        message:
          'Identity actor is linked to a magic MCP endpoint backing and cannot be deleted.',
        code: 'identity_actor_in_use_by_magic_mcp_backing',
        data: {
          identityActorId: d.identityActorId,
          magicMcpEndpointBackingId: magicMcpEndpointBacking.id
        }
      })
    );
  }
};
