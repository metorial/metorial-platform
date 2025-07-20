import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSecretsGetOutput,
  mapDashboardInstanceSecretsListOutput,
  mapDashboardInstanceSecretsListQuery,
  type DashboardInstanceSecretsGetOutput,
  type DashboardInstanceSecretsListOutput,
  type DashboardInstanceSecretsListQuery
} from '../resources';

/**
 * @name Secrets controller
 * @description Secrets represent sensitive information securely stored by Metorial. Secrets are automatically created by Metorial, for example for server deployment configurations.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialSecretsEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name List secrets
   * @description Returns a paginated list of secrets for the instance, optionally filtered by type or status.
   *
   * @param `query` - DashboardInstanceSecretsListQuery
   *
   * @returns DashboardInstanceSecretsListOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(query?: DashboardInstanceSecretsListQuery) {
    return this._get({
      path: ['secrets'],

      query: query
        ? mapDashboardInstanceSecretsListQuery.transformTo(query)
        : undefined
    }).transform(mapDashboardInstanceSecretsListOutput);
  }

  /**
   * @name Get secret by ID
   * @description Retrieves detailed information about a specific secret by ID.
   *
   * @param `secretId` - string
   *
   * @returns DashboardInstanceSecretsGetOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(secretId: string) {
    return this._get({
      path: ['secrets', secretId]
    }).transform(mapDashboardInstanceSecretsGetOutput);
  }
}
