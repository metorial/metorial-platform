export type ScopeChange = 'upserted' | 'limits_changed' | 'archived';

export type ConnectionChange = 'upserted' | 'status_changed' | 'archived';

export type AiGatewayEvents = {
  'scope.organization.changed:after': { organizationId: string; change: ScopeChange };
  'scope.project.changed:after': {
    organizationId: string;
    projectId: string;
    instanceIds: string[];
    change: ScopeChange;
  };
  'scope.instance.changed:after': {
    organizationId: string;
    instanceId: string;
    change: ScopeChange;
  };

  'credentials.connection.changed:after': {
    connectionId: string;
    instanceId: string;
    change: ConnectionChange;
  };

  'virtualModels.virtualModel.changed:after': {
    virtualModelId: string;
    instanceId: string;
    change: ScopeChange;
  };

  'catalog.synced:after': { fingerprint: string };
};
