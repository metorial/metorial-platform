import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapConsumerDeviceDetectionCatalogGetOutput,
  type ConsumerDeviceDetectionCatalogGetOutput
} from '../resources';

/**
 * @name Consumer Devices controller
 * @description Enroll Metorial Desktop devices and choose which integrations and skills each AI tool on them receives.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialConsumerDeviceDetectionCatalogEndpoint {
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
   * @name Get device detection catalog
   * @description Returns the signals Metorial Desktop matches to find AI tools on a device. The response carries an `ETag`; send it back in `If-None-Match` to get a 304 while the catalog is unchanged. Returns 404 when AI tool detection is not available to the organization.
   *
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ConsumerDeviceDetectionCatalogGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(opts?: {
    headers?: Record<string, string>;
  }): Promise<ConsumerDeviceDetectionCatalogGetOutput> {
    let path = 'consumer/device-detection-catalog';

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapConsumerDeviceDetectionCatalogGetOutput
    );
  }
}
