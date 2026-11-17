import type { SecurityControlKey } from '@metorial-subspace/db';
import type { SubjectKind } from '../lib/evidence';

export type SecurityControlDefinition = {
  key: SecurityControlKey;
  title: string;
  description: string;
  weight: number;
  appliesTo: SubjectKind[];
  guaranteedFor?: SubjectKind[];
};

let serverKinds: SubjectKind[] = ['slate', 'function', 'remote', 'container'];

export let securityControls: SecurityControlDefinition[] = [
  {
    key: 'input_scoping',
    title: 'Inputs are scoped',
    description:
      'Parameters that name resources, paths, URLs, queries or accounts are validated or bounded to the connected account, so a caller cannot reach beyond it or inject into a downstream query.',
    weight: 3,
    appliesTo: serverKinds
  },
  {
    key: 'destination_restriction',
    title: 'Outbound destinations are fixed',
    description:
      "Outbound requests go only to the vendor's API or to a destination the user explicitly selects. No tool forwards data to an arbitrary host taken from input or fetched content.",
    weight: 3,
    appliesTo: serverKinds
  },
  {
    key: 'destructive_targeting',
    title: 'Destructive operations need an explicit target',
    description:
      'Delete, overwrite and bulk operations act on an explicitly identified resource. There are no wildcard, filter-only or unbounded destructive calls. Not applicable when no tool changes or deletes data.',
    weight: 2,
    appliesTo: serverKinds
  },
  {
    key: 'untrusted_content_separation',
    title: 'Untrusted content stays data',
    description:
      'Third-party content a tool returns (messages, documents, web pages) is returned as data, and tool descriptions never tell the model to follow instructions found in it. Not applicable when no tool returns third-party content.',
    weight: 2,
    appliesTo: serverKinds
  },
  {
    key: 'secret_hygiene',
    title: 'Secrets stay out of outputs',
    description:
      'Credentials, tokens and keys are never returned in tool output, error messages or logs, and are not hardcoded in the source.',
    weight: 3,
    appliesTo: serverKinds,
    guaranteedFor: ['slate']
  },
  {
    key: 'least_privilege_access',
    title: 'Access is least-privilege',
    description:
      'The OAuth scopes, API key permissions or service credentials the server asks for are limited to what its tools need.',
    weight: 2,
    appliesTo: serverKinds,
    guaranteedFor: ['slate']
  },
  {
    key: 'accurate_annotations',
    title: 'Tool annotations are accurate',
    description:
      'Tools declare read-only and destructive hints and those hints match their behavior, so clients can ask for confirmation where it matters.',
    weight: 1,
    appliesTo: serverKinds,
    guaranteedFor: ['slate']
  },
  {
    key: 'transport_security',
    title: 'Transport is encrypted',
    description: 'The server is reached over HTTPS.',
    weight: 1,
    appliesTo: serverKinds,
    guaranteedFor: ['slate', 'function', 'container']
  },
  {
    key: 'dependency_hygiene',
    title: 'Dependencies are maintained',
    description:
      'Dependencies are pinned and none of the reviewed versions has a known vulnerability that the code reaches.',
    weight: 2,
    appliesTo: ['slate', 'function'],
    guaranteedFor: ['slate']
  },
  {
    key: 'path_scoping',
    title: 'File access is scoped',
    description:
      "File reads, writes and deletes stay inside the project, the skill's own directory or paths the user selects. Not applicable when the skill touches no files.",
    weight: 3,
    appliesTo: ['skill']
  },
  {
    key: 'egress_restriction',
    title: 'Network access is limited to named hosts',
    description:
      'Network requests go only to hosts the skill names for its purpose. Not applicable when the skill makes no network requests.',
    weight: 3,
    appliesTo: ['skill']
  },
  {
    key: 'safe_command_construction',
    title: 'Commands are built safely',
    description:
      'Shell commands and scripts do not interpolate untrusted or user-supplied values into a shell string, eval or an unquoted command line. Not applicable when the skill runs no commands.',
    weight: 3,
    appliesTo: ['skill']
  },
  {
    key: 'credential_isolation',
    title: 'Credentials are isolated',
    description:
      'Credentials are read only from documented sources the purpose needs, and are never printed, written to files or sent anywhere else. Not applicable when the skill handles no credentials.',
    weight: 3,
    appliesTo: ['skill']
  },
  {
    key: 'dependency_hygiene',
    title: 'Installs and downloads are pinned',
    description:
      'Packages, toolchains and downloads are pinned to versions or checksums and come from their official registries. Not applicable when the skill installs or downloads nothing.',
    weight: 2,
    appliesTo: ['skill']
  },
  {
    key: 'destructive_confirmation',
    title: 'Destructive steps are confirmed',
    description:
      'Destructive or irreversible steps are scoped to what the skill owns and are confirmed with the user before they run. Not applicable when the skill changes nothing irreversibly.',
    weight: 2,
    appliesTo: ['skill']
  },
  {
    key: 'minimal_permissions',
    title: 'Permissions are minimal',
    description:
      'allowed-tools, permission modes and subagent tool lists are restricted to what the workflow needs, and nothing bypasses permission prompts.',
    weight: 2,
    appliesTo: ['skill']
  },
  {
    key: 'transparent_content',
    title: 'Content is transparent',
    description:
      'There is no hidden, encoded, obfuscated or binary content that the agent is told to run or follow.',
    weight: 2,
    appliesTo: ['skill']
  },
  {
    key: 'scoped_activation',
    title: 'Activation is scoped',
    description:
      'The description makes the skill activate only for the work it is built for, not for broad or unrelated requests.',
    weight: 1,
    appliesTo: ['skill']
  }
];

export let controlsFor = (kind: SubjectKind) =>
  securityControls.filter(control => control.appliesTo.includes(kind));

export let assessableControlsFor = (kind: SubjectKind) =>
  controlsFor(kind).filter(control => !control.guaranteedFor?.includes(kind));

export let controlDefinition = (kind: SubjectKind, key: SecurityControlKey) =>
  controlsFor(kind).find(control => control.key == key);

export let controlWeight = (key: SecurityControlKey) =>
  securityControls.find(control => control.key == key)?.weight ?? 0;
