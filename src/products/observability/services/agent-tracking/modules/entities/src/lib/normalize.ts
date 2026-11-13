import { badRequestError, ServiceError } from '@lowerdeck/error';

let maxSlugLength = 64;
let maxIdentifierLength = 512;

let slugPattern = /^[a-z0-9][a-z0-9_.-]*$/;

export type IdentifierInput = { type: string; value: string };

export let normalizeEmail = (email: string) => email.trim().toLowerCase();

export let isEmailIdentifierType = (type: string) =>
  type == 'email' || type.startsWith('email:');

let isCaseInsensitiveType = (type: string) =>
  isEmailIdentifierType(type) || type == 'remote' || type.startsWith('remote:');

export let normalizeIdentifier = (identifier: IdentifierInput): IdentifierInput => {
  let type = identifier.type.trim().toLowerCase();
  let value = identifier.value.trim();
  if (isCaseInsensitiveType(type)) value = value.toLowerCase();

  if (
    !type ||
    !value ||
    type.length > maxIdentifierLength ||
    value.length > maxIdentifierLength
  ) {
    throw new ServiceError(
      badRequestError({
        message: `Invalid identifier ${identifier.type}:${identifier.value}.`
      })
    );
  }

  return { type, value };
};

export let normalizeIdentifiers = (identifiers: IdentifierInput[]) => {
  let seen = new Set<string>();

  return identifiers.map(normalizeIdentifier).filter(identifier => {
    let key = `${identifier.type}\u0000${identifier.value}`;
    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
};

export let emailsOf = (identifiers: IdentifierInput[]) =>
  identifiers
    .filter(identifier => identifier.type == 'email')
    .map(identifier => identifier.value);

export let isValidSlug = (slug: string) =>
  slug.length <= maxSlugLength && slugPattern.test(slug);

export let normalizeSlug = (slug: string) => {
  let normalized = slug.trim().toLowerCase();

  if (!isValidSlug(normalized)) {
    throw new ServiceError(
      badRequestError({
        message: `Invalid slug "${slug}": use lowercase letters, digits, "-", "_" and ".", starting with a letter or digit.`
      })
    );
  }

  return normalized;
};
