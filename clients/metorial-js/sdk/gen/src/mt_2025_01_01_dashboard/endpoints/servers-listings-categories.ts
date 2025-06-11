import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapServersListingsCategoriesGetOutput,
  mapServersListingsCategoriesListOutput,
  mapServersListingsCategoriesListQuery,
  type ServersListingsCategoriesGetOutput,
  type ServersListingsCategoriesListOutput,
  type ServersListingsCategoriesListQuery
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
   * @param `query` - ServersListingsCategoriesListQuery
   *
   * @returns ServersListingsCategoriesListOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(query?: ServersListingsCategoriesListQuery) {
    return this._get({
      path: ['server-listing-categories'],

      query: query
        ? mapServersListingsCategoriesListQuery.transformTo(query)
        : undefined
    }).transform(mapServersListingsCategoriesListOutput);
  }

  /**
   * @name Get server version
   * @description Get the information of a specific server version
   *
   * @param `serverListingCategoryId` - string
   *
   * @returns ServersListingsCategoriesGetOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(serverListingCategoryId: string) {
    return this._get({
      path: ['server-listing-categories', serverListingCategoryId]
    }).transform(mapServersListingsCategoriesGetOutput);
  }
}
