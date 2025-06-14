import { BaseMetorialEndpoint, MetorialEndpointManager } from '@metorial/util-endpoint';

export class MetorialAuthEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  login(data: { email: string; password: string }) {
    return this._post({
      path: ['_', 'auth', 'login'],
      body: {
        email: data.email,
        password: data.password
      }
    }).transform({
      transformFrom: d => d as {}
    });
  }

  signup(data: { name: string; email: string; password: string }) {
    return this._post({
      path: ['_', 'auth', 'signup'],
      body: {
        name: data.name,
        email: data.email,
        password: data.password
      }
    }).transform({
      transformFrom: d => d as {}
    });
  }

  logout() {
    return this._post({
      path: ['_', 'auth', 'logout']
    }).transform({
      transformFrom: d => d as {}
    });
  }
}
