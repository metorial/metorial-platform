export type SandboxImageLogoName =
  | 'bun'
  | 'deno'
  | 'node'
  | 'python'
  | 'ruby'
  | 'go'
  | 'rust'
  | 'java'
  | 'dotnet'
  | 'php'
  | 'alpine'
  | 'debian'
  | 'ubuntu';

export interface SandboxImageLogo {
  name: SandboxImageLogoName;
  url: string;
}

let logoBaseUrl = 'https://provider-logos.metorial-cdn.com/sandbox';

let logoRules: { name: SandboxImageLogoName; tokens: string[]; extension?: 'png' }[] = [
  { name: 'bun', tokens: ['bun'] },
  { name: 'deno', tokens: ['deno'] },
  { name: 'node', tokens: ['node', 'nodejs'] },
  { name: 'python', tokens: ['python', 'py', 'pypy'] },
  { name: 'ruby', tokens: ['ruby', 'rails'] },
  { name: 'go', tokens: ['go', 'golang'] },
  { name: 'rust', tokens: ['rust', 'cargo'] },
  { name: 'java', tokens: ['java', 'jdk', 'openjdk', 'jre', 'temurin'] },
  { name: 'dotnet', tokens: ['dotnet', 'aspnet', 'csharp'] },
  { name: 'php', tokens: ['php'] },
  { name: 'alpine', tokens: ['alpine'] },
  { name: 'debian', tokens: ['debian', 'bookworm', 'bullseye', 'trixie'], extension: 'png' },
  { name: 'ubuntu', tokens: ['ubuntu', 'noble', 'jammy', 'focal'] }
];

export let getSandboxImageLogoUrl = (name: SandboxImageLogoName) => {
  let rule = logoRules.find(r => r.name == name);
  return `${logoBaseUrl}/${name}.${rule?.extension ?? 'svg'}`;
};

export let tokenizeImageText = (text: string) => {
  let tokens = text
    .toLowerCase()
    .replace(/\.net(?![a-z])/g, ' dotnet')
    .split(/[^a-z0-9]+/)
    .map(token => token.replace(/\d+$/, ''))
    .filter(Boolean);

  return new Set(tokens);
};

export let detectImageLogo = (
  image: string | { name?: string | null; identifier?: string | null } | null | undefined
): SandboxImageLogo | null => {
  if (!image) return null;

  let text =
    typeof image == 'string'
      ? image
      : [image.name, image.identifier].filter(Boolean).join(' ');

  let tokens = tokenizeImageText(text);
  if (!tokens.size) return null;

  let rule = logoRules.find(r => r.tokens.some(token => tokens.has(token)));
  if (!rule) return null;

  return { name: rule.name, url: getSandboxImageLogoUrl(rule.name) };
};
