/**
 * Result of {@link validateLinkUrl}: either a successfully parsed
 * normalized `https?:` URL, or a human-readable rejection reason.
 */
export type LinkValidation = { ok: true; url: string } | { ok: false; reason: string };

let PROTOCOL_REGEX = /^[a-z][a-z0-9+\-.]*:\/\//i;

/**
 * Validate and normalize a URL entered by the user before persisting it
 * as a link mark.
 *
 * Rules enforced:
 *   - Must parse as a valid URL (URL constructor must accept it).
 *   - Only `http:` and `https:` protocols are allowed.
 *   - Auto-prepends `https://` when the user typed a bare host.
 *   - Rejects URLs that contain `user:password@` credentials.
 *   - Requires a non-empty hostname.
 */
export function validateLinkUrl(input: string): LinkValidation {
  let trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, reason: 'Enter a URL' };
  }

  let normalized: string;
  if (PROTOCOL_REGEX.test(trimmed)) {
    if (!/^https?:\/\//i.test(trimmed)) {
      return { ok: false, reason: 'Only http:// and https:// links are allowed' };
    }
    normalized = trimmed;
  } else {
    if (trimmed.includes(' ')) {
      return { ok: false, reason: 'URL cannot contain spaces' };
    }
    normalized = `https://${trimmed}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    return { ok: false, reason: "That doesn't look like a valid URL" };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, reason: 'Only http:// and https:// links are allowed' };
  }

  if (parsed.username || parsed.password) {
    return {
      ok: false,
      reason: 'URLs with embedded credentials are not allowed'
    };
  }

  if (!parsed.hostname) {
    return { ok: false, reason: 'URL must include a hostname' };
  }

  // Reject hostnames that don't contain a dot AND aren't 'localhost'-ish.
  // Allows `https://localhost:3000` while rejecting nonsense like `https://foo`.
  let isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(parsed.hostname);
  if (!isLocal && !parsed.hostname.includes('.')) {
    return { ok: false, reason: 'URL must include a valid domain' };
  }

  return { ok: true, url: parsed.toString() };
}
