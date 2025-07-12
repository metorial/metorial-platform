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
export class MetorialSecretsEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name List secrets
   * @description List all  secrets
   *
   * @param `query` - DashboardInstanceSecretsListQuery
   *
   * @returns DashboardInstanceSecretsListOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstanceSecretsListQuery
  ): Promise<DashboardInstanceSecretsListOutput> {
    let path = 'secrets';
    return this._get({
      path,

      query: query
        ? mapDashboardInstanceSecretsListQuery.transformTo(query)
        : undefined
    }).transform(mapDashboardInstanceSecretsListOutput);
  }

  /**
   * @name Get secret
   * @description Get the information of a specific secret
   *
   * @param `secretId` - string
   *
   * @returns DashboardInstanceSecretsGetOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(secretId: string): Promise<DashboardInstanceSecretsGetOutput> {
    let path = `secrets/${secretId}`;
    return this._get({
      path
    }).transform(mapDashboardInstanceSecretsGetOutput);
  }
}
