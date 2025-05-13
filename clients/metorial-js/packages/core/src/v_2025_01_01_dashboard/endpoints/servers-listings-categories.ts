import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceServersListingsCategoriesGetOutput,
  mapDashboardInstanceServersListingsCategoriesListOutput,
  mapDashboardInstanceServersListingsCategoriesListQuery,
  type DashboardInstanceServersListingsCategoriesGetOutput,
  type DashboardInstanceServersListingsCategoriesListOutput,
  type DashboardInstanceServersListingsCategoriesListQuery
} from '../resources';

/**
 * @name Server Category controller
 * @description Read and write server version information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialServersListingsCategoriesEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name List server versions
   * @description List all server versions
   *
   * @param `query` - DashboardInstanceServersListingsCategoriesListQuery
   *
   * @returns DashboardInstanceServersListingsCategoriesListOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(query?: DashboardInstanceServersListingsCategoriesListQuery) {
    return this._get({
      path: ['server-listing-categories'],

      query: query
        ? mapDashboardInstanceServersListingsCategoriesListQuery.transformTo(
            query
          )
        : undefined
    }).transform(mapDashboardInstanceServersListingsCategoriesListOutput);
  }

  /**
   * @name Get server version
   * @description Get the information of a specific server version
   *
   * @param `serverListingCategoryId` - string
   *
   * @returns DashboardInstanceServersListingsCategoriesGetOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(serverListingCategoryId: string) {
    return this._get({
      path: ['server-listing-categories', serverListingCategoryId]
    }).transform(mapDashboardInstanceServersListingsCategoriesGetOutput);
  }
}
