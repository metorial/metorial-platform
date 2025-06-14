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
 * @name Secret controller
 * @description Read and write secret information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceSecretsEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name List secrets
   * @description List all  secrets
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceSecretsListQuery
   *
   * @returns DashboardInstanceSecretsListOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(instanceId: string, query?: DashboardInstanceSecretsListQuery) {
    return this._get({
      path: ['instances', instanceId, 'secrets'],

      query: query
        ? mapDashboardInstanceSecretsListQuery.transformTo(query)
        : undefined
    }).transform(mapDashboardInstanceSecretsListOutput);
  }

  /**
   * @name Get secret
   * @description Get the information of a specific secret
   *
   * @param `instanceId` - string
   * @param `secretId` - string
   *
   * @returns DashboardInstanceSecretsGetOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(instanceId: string, secretId: string) {
    return this._get({
      path: ['instances', instanceId, 'secrets', secretId]
    }).transform(mapDashboardInstanceSecretsGetOutput);
  }
}
