import { Instance, ProviderOAuthConfig, ProviderOAuthConnection } from '@metorial/db';

export class DProviderOauthConnection {
  id!: string;
  name!: string | null;
  description!: string | null;
  clientId!: string | null;
  scopes!: string[];
  config!: any;
  createdAt!: Date;
  updatedAt!: Date;
  instanceId!: string;
  metadata!: Record<string, any> | null;

  static async fromConnection(
    con: ProviderOAuthConnection & { instance: Instance; config: ProviderOAuthConfig }
  ): Promise<DProviderOauthConnection> {
    let res = new DProviderOauthConnection();

    res.id = con.id;
    res.name = con.name;
    res.description = con.description;
    res.clientId = con.clientId;
    res.scopes = con.config.scopes;
    res.config = con.config.config;
    res.createdAt = con.createdAt;
    res.updatedAt = con.updatedAt;
    res.instanceId = con.instance.id;
    res.metadata = con.metadata ?? {};

    return res;
  }
}
