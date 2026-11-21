import { badRequestError, ServiceError } from '@lowerdeck/error';
import { v } from '@lowerdeck/validation';
import type { Prisma } from '@mtsrc/auth-core-db';
import { redactSsoPayload } from '@mtsrc/auth-core-http/src/ssoDiagnostics';
import { hashUid } from '@mtsrc/auth-core-module-sso';

let optionalText = v.optional(v.nullable(v.string()));
let optionalMemberships = v.optional(v.nullable(v.array(v.string())));

let profileValidator = v.object({
  id: v.string(),
  idHash: optionalText,
  email: v.string(),
  firstName: optionalText,
  lastName: optionalText,
  sub: optionalText,
  groups: optionalMemberships,
  roles: optionalMemberships,
  raw: v.optional(v.nullable(v.record(v.any())))
});

export let normalizeSsoProviderProfile = (input: unknown) => {
  let result = profileValidator.validate(input);
  if (!result.success || !result.value.id.trim() || !result.value.email.trim()) {
    throw new ServiceError(badRequestError({ message: 'Invalid identity provider profile' }));
  }

  let profile = result.value;

  return {
    email: profile.email,
    uid: profile.id,
    uidHash: profile.idHash?.trim() ? profile.idHash : hashUid(profile.id),
    sub: profile.sub ?? undefined,
    firstName: profile.firstName ?? undefined,
    lastName: profile.lastName ?? undefined,
    groups: profile.groups ?? [],
    roles: profile.roles ?? [],
    raw: redactSsoPayload(profile.raw ?? {}) as Prisma.InputJsonObject
  };
};
