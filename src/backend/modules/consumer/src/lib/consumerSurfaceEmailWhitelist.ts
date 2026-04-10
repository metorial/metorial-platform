import { badRequestError, ServiceError } from '@lowerdeck/error';

let domainLabelPattern = '[a-z0-9](?:[a-z0-9-]*[a-z0-9])?';
let domainPattern = new RegExp(`^${domainLabelPattern}(?:\\.${domainLabelPattern})*$`);
let wildcardDomainPattern = new RegExp(
  `^\\*@(${domainLabelPattern}(?:\\.${domainLabelPattern})*)$`
);
let emailPattern = new RegExp(
  `^[^\\s@]+@(${domainLabelPattern}(?:\\.${domainLabelPattern})*)$`
);

let getInvalidEmailWhitelistEntryError = (input: string) =>
  new ServiceError(
    badRequestError({
      message: `Invalid consumer surface email whitelist entry: ${input}`,
      description:
        'Valid email whitelist entries must be in the format "*@domain", "domain", or "email@domain".'
    })
  );

export let normalizeConsumerSurfaceEmail = (email: string) => email.trim().toLowerCase();

export let normalizeConsumerSurfaceEmailWhitelistEntry = (input: string) => {
  let value = input.trim().toLowerCase();

  if (!value) {
    throw getInvalidEmailWhitelistEntryError(input);
  }

  let wildcardMatch = value.match(wildcardDomainPattern);
  if (wildcardMatch) {
    return wildcardMatch[1]!;
  }

  if (emailPattern.test(value)) {
    return value;
  }

  if (domainPattern.test(value)) {
    return value;
  }

  throw getInvalidEmailWhitelistEntryError(input);
};

export let normalizeConsumerSurfaceEmailWhitelist = (inputs: string[]) => {
  return Array.from(
    new Set(inputs.map(input => normalizeConsumerSurfaceEmailWhitelistEntry(input)))
  ).sort((a, b) => a.localeCompare(b));
};

export let isConsumerSurfaceEmailWhitelisted = (d: {
  email: string;
  emailWhitelist: string[];
}) => {
  if (!d.emailWhitelist.length) {
    return true;
  }

  let email = normalizeConsumerSurfaceEmail(d.email);
  let [, domain] = email.split('@');
  if (!domain) {
    return false;
  }

  let whitelist = new Set(d.emailWhitelist);

  return whitelist.has(email) || whitelist.has(domain);
};
