import { badRequestError, forbiddenError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { assertEdition, checkEdition } from '@metorial/editions';
import { db, type App } from '@mtsrc/auth-core-db';
import { parseEmail } from '@mtsrc/auth-core-identity-utils';
import { auditLogService } from '@mtsrc/auth-core-module-audit';
import {
  evaluateRegisteredDomainSignup,
  normalizeRegisteredDomains
} from '../lib/registeredDomainPolicy';

class RegisteredDomainPolicyServiceImpl {
  async assertSignupAllowed(d: {
    app: App;
    email: string;
    context?: { ip?: string | null; ua?: string | null };
  }) {
    if (!checkEdition('on-prem')) return;
    if (!d.app.restrictSignupToRegisteredDomains) return;

    let parsed: { email: string; domain: string } | null = null;
    try {
      parsed = parseEmail(d.email);
    } catch {
      parsed = null;
    }

    let existingUser = parsed
      ? await db.user.findFirst({
          where: {
            appOid: d.app.oid,
            OR: [
              { email: parsed.email },
              { userEmails: { some: { email: parsed.email, verifiedAt: { not: null } } } }
            ]
          },
          select: { oid: true }
        })
      : null;

    let decision = parsed
      ? evaluateRegisteredDomainSignup({
          domain: parsed.domain,
          userExists: !!existingUser,
          registeredDomains: d.app.registeredDomains
        })
      : ({ allowed: false, reason: 'invalid_domain' } as const);

    if (decision.allowed) return;

    auditLogService.log({
      appOid: d.app.oid,
      type: 'login.blocked_unregistered_domain',
      ip: d.context?.ip,
      ua: d.context?.ua,
      metadata: { reason: decision.reason, domain: parsed?.domain ?? null }
    });

    throw new ServiceError(
      forbiddenError({
        message: 'Only users with a registered email domain can sign in.',
        code: 'registered_domain_required'
      })
    );
  }

  async setPolicy(d: {
    app: App;
    input: { enabled: boolean; owner: string | null; domains: string[] };
  }) {
    assertEdition('on-prem');

    let domains: string[];
    try {
      domains = normalizeRegisteredDomains(d.input.domains);
    } catch (error) {
      throw new ServiceError(badRequestError({ message: (error as Error).message }));
    }

    return await db.app.update({
      where: { oid: d.app.oid },
      data: {
        restrictSignupToRegisteredDomains: d.input.enabled,
        registeredDomainOwner: d.input.enabled ? d.input.owner : null,
        registeredDomains: d.input.enabled ? domains : []
      },
      include: { defaultTenant: true, tenants: true, _count: { select: { users: true } } }
    });
  }
}

export let registeredDomainPolicyService = Service.create(
  'RegisteredDomainPolicyService',
  () => new RegisteredDomainPolicyServiceImpl()
).build();
