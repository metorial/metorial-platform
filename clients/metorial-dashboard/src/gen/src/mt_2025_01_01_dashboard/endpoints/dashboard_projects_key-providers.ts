import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardProjectsKeyProvidersCreateManagedBody,
  mapDashboardProjectsKeyProvidersCreateManagedOutput,
  mapDashboardProjectsKeyProvidersGetOutput,
  mapDashboardProjectsKeyProvidersGetSetupInfoOutput,
  mapDashboardProjectsKeyProvidersGetSetupInfoQuery,
  mapDashboardProjectsKeyProvidersImportBody,
  mapDashboardProjectsKeyProvidersImportOutput,
  mapDashboardProjectsKeyProvidersListOutput,
  mapDashboardProjectsKeyProvidersListQuery,
  mapDashboardProjectsKeyProvidersSetDefaultOutput,
  mapDashboardProjectsKeyProvidersValidateOutput,
  type DashboardProjectsKeyProvidersCreateManagedBody,
  type DashboardProjectsKeyProvidersCreateManagedOutput,
  type DashboardProjectsKeyProvidersGetOutput,
  type DashboardProjectsKeyProvidersGetSetupInfoOutput,
  type DashboardProjectsKeyProvidersGetSetupInfoQuery,
  type DashboardProjectsKeyProvidersImportBody,
  type DashboardProjectsKeyProvidersImportOutput,
  type DashboardProjectsKeyProvidersListOutput,
  type DashboardProjectsKeyProvidersListQuery,
  type DashboardProjectsKeyProvidersSetDefaultOutput,
  type DashboardProjectsKeyProvidersValidateOutput
} from '../resources';

/**
 * @name Key providers controller
 * @description Manage project encryption key providers and diagnostics
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardProjectsKeyProvidersEndpoint {
  constructor(private readonly _manager: MetorialEndpointManager<any>) {}

  // thin proxies so method bodies stay unchanged
  private _get(request: any) {
    return this._manager._get(request);
  }
  private _post(request: any) {
    return this._manager._post(request);
  }
  private _put(request: any) {
    return this._manager._put(request);
  }
  private _patch(request: any) {
    return this._manager._patch(request);
  }
  private _delete(request: any) {
    return this._manager._delete(request);
  }

  /**
   * @name List key providers
   * @description Returns a paginated list of key providers for a project
   *
   * @param `organizationId` - string
   * @param `projectId` - string
   * @param `query` - DashboardProjectsKeyProvidersListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardProjectsKeyProvidersListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    organizationId: string,
    projectId: string,
    query?: DashboardProjectsKeyProvidersListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardProjectsKeyProvidersListOutput> {
    let path = `dashboard/organizations/${organizationId}/projects/${projectId}/key-providers`;

    let request = {
      path,

      query: query
        ? mapDashboardProjectsKeyProvidersListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardProjectsKeyProvidersListOutput
    );
  }

  /**
   * @name Create managed key provider
   * @description Creates a Metorial-managed key provider for a project
   *
   * @param `organizationId` - string
   * @param `projectId` - string
   * @param `body` - DashboardProjectsKeyProvidersCreateManagedBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardProjectsKeyProvidersCreateManagedOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  createManaged(
    organizationId: string,
    projectId: string,
    body: DashboardProjectsKeyProvidersCreateManagedBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardProjectsKeyProvidersCreateManagedOutput> {
    let path = `dashboard/organizations/${organizationId}/projects/${projectId}/key-providers`;

    let request = {
      path,
      body: mapDashboardProjectsKeyProvidersCreateManagedBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardProjectsKeyProvidersCreateManagedOutput
    );
  }

  /**
   * @name Import key provider
   * @description Imports a customer-managed key provider for a project
   *
   * @param `organizationId` - string
   * @param `projectId` - string
   * @param `body` - DashboardProjectsKeyProvidersImportBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardProjectsKeyProvidersImportOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  import(
    organizationId: string,
    projectId: string,
    body: DashboardProjectsKeyProvidersImportBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardProjectsKeyProvidersImportOutput> {
    let path = `dashboard/organizations/${organizationId}/projects/${projectId}/key-providers/import`;

    let request = {
      path,
      body: mapDashboardProjectsKeyProvidersImportBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardProjectsKeyProvidersImportOutput
    );
  }

  /**
   * @name Get key provider
   * @description Retrieves a key provider for a project
   *
   * @param `organizationId` - string
   * @param `projectId` - string
   * @param `keyProviderId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardProjectsKeyProvidersGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    organizationId: string,
    projectId: string,
    keyProviderId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardProjectsKeyProvidersGetOutput> {
    let path = `dashboard/organizations/${organizationId}/projects/${projectId}/key-providers/${keyProviderId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardProjectsKeyProvidersGetOutput
    );
  }

  /**
   * @name Get key provider setup info
   * @description Returns setup instructions for importing a key provider
   *
   * @param `organizationId` - string
   * @param `projectId` - string
   * @param `keyProviderId` - string
   * @param `query` - DashboardProjectsKeyProvidersGetSetupInfoQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardProjectsKeyProvidersGetSetupInfoOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  getSetupInfo(
    organizationId: string,
    projectId: string,
    keyProviderId: string,
    query?: DashboardProjectsKeyProvidersGetSetupInfoQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardProjectsKeyProvidersGetSetupInfoOutput> {
    let path = `dashboard/organizations/${organizationId}/projects/${projectId}/key-providers/${keyProviderId}/setup-info`;

    let request = {
      path,

      query: query
        ? mapDashboardProjectsKeyProvidersGetSetupInfoQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardProjectsKeyProvidersGetSetupInfoOutput
    );
  }

  /**
   * @name Validate key provider
   * @description Validates that a key provider is reachable and configured correctly
   *
   * @param `organizationId` - string
   * @param `projectId` - string
   * @param `keyProviderId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardProjectsKeyProvidersValidateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  validate(
    organizationId: string,
    projectId: string,
    keyProviderId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardProjectsKeyProvidersValidateOutput> {
    let path = `dashboard/organizations/${organizationId}/projects/${projectId}/key-providers/${keyProviderId}/validate`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardProjectsKeyProvidersValidateOutput
    );
  }

  /**
   * @name Set default key provider
   * @description Sets the default key provider for a project
   *
   * @param `organizationId` - string
   * @param `projectId` - string
   * @param `keyProviderId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardProjectsKeyProvidersSetDefaultOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  setDefault(
    organizationId: string,
    projectId: string,
    keyProviderId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardProjectsKeyProvidersSetDefaultOutput> {
    let path = `dashboard/organizations/${organizationId}/projects/${projectId}/key-providers/${keyProviderId}/set-default`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardProjectsKeyProvidersSetDefaultOutput
    );
  }
}
