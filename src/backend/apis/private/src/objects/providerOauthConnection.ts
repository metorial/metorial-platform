import { Instance, ProviderOAuthConnection } from '@metorial/db';

export class DProviderOauthConnection {
  id: string;
  name: string | null;
  description: string | null;
  clientId: string;
  scopes: string[];
  config: any;
  createdAt: Date;
  updatedAt: Date;
  instanceId: string;
  metadata: Record<string, any> | null;

  static async fromConnection(
    user: ProviderOAuthConnection & { instance: Instance }
  ): Promise<DProviderOauthConnection> {
    let res = new DProviderOauthConnection();

    res.id = user.id;
    res.name = user.name;
    res.description = user.description;
    res.clientId = user.clientId;
    res.scopes = user.scopes;
    res.config = user.config;
    res.createdAt = user.createdAt;
    res.updatedAt = user.updatedAt;
    res.instanceId = user.instance.id;
    res.metadata = user.metadata ?? {};

    return res;
  }
}
