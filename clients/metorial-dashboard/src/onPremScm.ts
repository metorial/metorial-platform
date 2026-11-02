import { BaseMetorialEndpoint } from '@metorial/util-endpoint';

export type OnPremScmProviderType =
  | 'github'
  | 'github_enterprise'
  | 'gitlab'
  | 'gitlab_selfhosted'
  | 'bitbucket'
  | 'bitbucket_data_center';

export class MetorialOnPremScmEndpoint extends BaseMetorialEndpoint<any> {
  options(instanceId: string) {
    return this._get({
      path: ['dashboard', 'instances', instanceId, 'scm', 'provider-options']
    }).transform({
      transformFrom: value => {
        let data = value as {
          items: {
            type: OnPremScmProviderType;
            label: string;
            allowed_domains: string[] | null;
          }[];
        };
        return data.items.map(item => ({
          type: item.type,
          label: item.label,
          allowedDomains: item.allowed_domains
        }));
      }
    });
  }

  listProviders(instanceId: string, query: Record<string, unknown>) {
    return this._get({
      path: ['dashboard', 'instances', instanceId, 'scm', 'providers'],
      query
    }).transform({
      transformFrom: value => {
        let data = value as {
          items: Record<string, any>[];
          pagination: { has_more_after: boolean; has_more_before: boolean };
        };
        return {
          ...data,
          items: data.items.map(item => ({
            object: item.object,
            id: item.id,
            type: item.type as OnPremScmProviderType,
            name: item.name,
            description: item.description,
            apiUrl: item.api_url,
            webUrl: item.web_url,
            isDefault: item.is_default,
            appWebhookUrl: item.app_webhook_url as string | null,
            createdAt: new Date(item.created_at),
            updatedAt: new Date(item.updated_at)
          })),
          pagination: {
            hasMoreAfter: data.pagination.has_more_after,
            hasMoreBefore: data.pagination.has_more_before
          }
        };
      }
    });
  }

  createProvider(instanceId: string, type: OnPremScmProviderType) {
    return this._post({
      path: ['dashboard', 'instances', instanceId, 'scm', 'providers'],
      body: { type }
    }).transform({ transformFrom: value => value as { url: string } });
  }
}
