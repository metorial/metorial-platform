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
 * @name Server Listing Category controller
 * @description Provides access to server listing categories, used for organizing and filtering server listings.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialServersListingsCategoriesEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name List server listing categories
   * @description Returns a list of all available server listing categories.
   *
   * @param `query` - ServersListingsCategoriesListQuery
   *
   * @returns ServersListingsCategoriesListOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: ServersListingsCategoriesListQuery
  ): Promise<ServersListingsCategoriesListOutput> {
    let path = 'server-listing-categories';
    return this._get({
      path,

      query: query
        ? mapServersListingsCategoriesListQuery.transformTo(query)
        : undefined
    }).transform(mapServersListingsCategoriesListOutput);
  }

  /**
   * @name Get server listing category
   * @description Returns information for a specific server listing category.
   *
   * @param `serverListingCategoryId` - string
   *
   * @returns ServersListingsCategoriesGetOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    serverListingCategoryId: string
  ): Promise<ServersListingsCategoriesGetOutput> {
    let path = `server-listing-categories/${serverListingCategoryId}`;
    return this._get({
      path
    }).transform(mapServersListingsCategoriesGetOutput);
  }
}
