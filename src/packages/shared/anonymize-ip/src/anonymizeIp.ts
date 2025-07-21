interface AnonymizationOptionsSingle {
  // For IPv4: number of octets to keep (1-3, default: 2)
  // For IPv6: number of groups to keep (1-7, default: 4)
  keepGroups?: number;
  // Character to use for masking (default: 'x')
  maskChar?: string;
}

interface AnonymizationOptions {
  maskChar?: string;
  keepGroups?:
    | {
        ipv4?: number;
        ipv6?: number;
      }
    | number;
}

let isIPv4 = (ip: string) => {
  let ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipv4Regex.test(ip)) return false;

  return ip.split('.').every(octet => {
    let num = parseInt(octet, 10);
    return num >= 0 && num <= 255;
  });
};

let isIPv6 = (ip: string) => {
  // Handle IPv6 with embedded IPv4 (e.g., ::ffff:192.0.2.1)
  if (ip.includes('.')) {
    let parts = ip.split(':');
    let lastPart = parts[parts.length - 1];
    if (isIPv4(lastPart)) {
      // Remove the IPv4 part and validate the IPv6 part
      let ipv6Part = ip.substring(0, ip.lastIndexOf(':') + 1) + '0';
      return isIPv6Simple(ipv6Part);
    }
  }

  return isIPv6Simple(ip);
};

let isIPv6Simple = (ip: string) => {
  let ipv6Regex = /^([0-9a-fA-F]{0,4}:){1,7}[0-9a-fA-F]{0,4}$/;

  if (ip.includes('::')) {
    let parts = ip.split('::');
    if (parts.length !== 2) return false;

    let leftGroups = parts[0] ? parts[0].split(':').length : 0;
    let rightGroups = parts[1] ? parts[1].split(':').length : 0;

    // Total groups should not exceed 8
    if (leftGroups + rightGroups > 7) return false;
  }

  return ipv6Regex.test(ip) || ip === '::';
};

let anonymizeIPv4 = (ip: string, options: AnonymizationOptionsSingle = {}) => {
  let { keepGroups = 2, maskChar = 'x' } = options;
  let octets = ip.split('.');

  if (keepGroups < 1 || keepGroups > 3) {
    throw new Error('keepGroups for IPv4 must be between 1 and 3');
  }

  let maskedOctets = octets.map((octet, index) => {
    if (index < keepGroups) {
      return octet;
    }
    return maskChar.repeat(octet.length);
  });

  return maskedOctets.join('.');
};

let anonymizeIPv6 = (ip: string, options: AnonymizationOptionsSingle = {}) => {
  let { keepGroups = 4, maskChar = 'x' } = options;

  if (keepGroups < 1 || keepGroups > 7) {
    throw new Error('keepGroups for IPv6 must be between 1 and 7');
  }

  // Handle IPv6 with embedded IPv4
  if (ip.includes('.')) {
    let lastColonIndex = ip.lastIndexOf(':');
    let ipv6Part = ip.substring(0, lastColonIndex + 1);
    let ipv4Part = ip.substring(lastColonIndex + 1);

    if (isIPv4(ipv4Part)) {
      let anonymizedIPv4 = anonymizeIPv4(ipv4Part, { keepGroups: 2, maskChar });
      let anonymizedIPv6Part = anonymizeIPv6Simple(ipv6Part + '0', keepGroups, maskChar);
      return (
        anonymizedIPv6Part.substring(0, anonymizedIPv6Part.lastIndexOf(':') + 1) +
        anonymizedIPv4
      );
    }
  }

  return anonymizeIPv6Simple(ip, keepGroups, maskChar);
};

let anonymizeIPv6Simple = (ip: string, keepGroups: number, maskChar: string) => {
  // Expand compressed notation for easier processing
  let expanded = ip;

  if (ip.includes('::')) {
    let parts = ip.split('::');
    let leftPart = parts[0] || '';
    let rightPart = parts[1] || '';

    let leftGroups = leftPart ? leftPart.split(':') : [];
    let rightGroups = rightPart ? rightPart.split(':') : [];

    let missingGroups = 8 - leftGroups.length - rightGroups.length;
    let zeroGroups = Array(missingGroups).fill('0');

    let allGroups = [...leftGroups, ...zeroGroups, ...rightGroups];
    expanded = allGroups.join(':');
  }

  let groups = expanded.split(':');

  let maskedGroups = groups.map((group, index) => {
    if (index < keepGroups) {
      return group;
    }
    return maskChar.repeat(Math.max(1, group.length));
  });

  return maskedGroups.join(':');
};

export let anonymizeIP = (ip: string, options: AnonymizationOptions = {}) => {
  if (!ip || typeof ip !== 'string') {
    throw new Error('IP address must be a non-empty string');
  }

  let trimmedIP = ip.trim();

  if (isIPv4(trimmedIP)) {
    return anonymizeIPv4(trimmedIP, {
      keepGroups:
        typeof options.keepGroups === 'number' ? options.keepGroups : options.keepGroups?.ipv4,
      maskChar: options.maskChar
    }).replace('000', '0'); // Ensure no triple zeros in IPv4
  }

  if (isIPv6(trimmedIP)) {
    return anonymizeIPv6(trimmedIP, {
      keepGroups:
        typeof options.keepGroups === 'number' ? options.keepGroups : options.keepGroups?.ipv6,
      maskChar: options.maskChar
    }).replace(/:0+:/g, '::'); // Ensure no double colons with zeros in IPv6
  }

  throw new Error('Invalid IP address format');
};
