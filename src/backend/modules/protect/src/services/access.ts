import {
  AccessLimiter,
  AccessLimiterTarget,
  db,
  ID,
  Organization,
  OrganizationActor
} from '@metorial/db';
import { badRequestError, ServiceError } from '@metorial/error';
import { Service } from '@metorial/service';
import { isIpInList } from '../lib/isIpInList';
import { isIpOrCidr } from '../lib/isIpOrCidr';

class accessLimiterServiceImpl {
  async createAccessLimiter(d: {
    target: AccessLimiterTarget;
    ipAllowlist: {
      ipWhitelist?: string[];
      ipBlacklist?: string[];
    } | null;
    createdByActor: OrganizationActor;
    organization: Organization;
  }) {
    if (d.ipAllowlist) {
      for (let ip of [
        ...(d.ipAllowlist.ipWhitelist || []),
        ...(d.ipAllowlist.ipBlacklist || [])
      ]) {
        if (!isIpOrCidr(ip)) {
          throw new ServiceError(
            badRequestError({
              message: `'${ip}' is not a valid IP address or CIDR notation.`
            })
          );
        }
      }
    }

    return await db.accessLimiter.create({
      data: {
        id: await ID.generateId('accessLimiter'),
        target: d.target,
        hasIpAllowlist: d.ipAllowlist !== null,
        ipWhitelist: d.ipAllowlist?.ipWhitelist ?? [],
        ipBlacklist: d.ipAllowlist?.ipBlacklist ?? [],
        createdByActorOid: d.createdByActor.oid,
        organizationOid: d.organization.oid
      }
    });
  }

  async checkAccessLimiter(d: {
    accessLimiter: AccessLimiter | null;
    ip: string;
    ua: string;
  }) {
    if (!d.accessLimiter) return true;

    if (d.accessLimiter.hasIpAllowlist) {
      if (d.accessLimiter.ipBlacklist.length > 0) {
        if (isIpInList(d.ip, d.accessLimiter.ipBlacklist)) return false;
      }

      if (d.accessLimiter.ipWhitelist.length > 0) {
        if (!isIpInList(d.ip, d.accessLimiter.ipWhitelist)) return false;
      }
    }

    return true;
  }
}

export let accessLimiterService = Service.create(
  'accessLimiterService',
  () => new accessLimiterServiceImpl()
).build();
