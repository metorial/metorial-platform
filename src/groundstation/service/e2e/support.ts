import { createClient } from '@lowerdeck/rpc-client';
import { uniqueId } from '@lowerdeck/testing-tools';
import { e2eEndpoint } from '@metorial/e2e/env';
import type { GroundstationClient } from '../src/controllers';

export let packageName = '@metorial/groundstation';

export let acceptedStatus = 200;

export let apiUrl = () => e2eEndpoint(packageName, 'api');
export let ingestUrl = () => e2eEndpoint(packageName, 'ingest');

export let groundstation = () =>
  createClient<GroundstationClient>({ endpoint: `${apiUrl()}/metorial-groundstation` });

type Client = GroundstationClient;

type OrganizationInput = Omit<Parameters<Client['organization']['upsert']>[0], 'ref'>;
type ProjectInput = Omit<Parameters<Client['project']['upsert']>[0], 'organizationId' | 'ref'>;
type InstanceInput = Omit<
  Parameters<Client['instance']['upsert']>[0],
  'organizationId' | 'projectId' | 'ref'
>;

export type ScopeInput = {
  organization?: OrganizationInput;
  project?: ProjectInput;
  instance?: InstanceInput;
};

export type Scope = Awaited<ReturnType<typeof createScope>>;

type TokenInput = Omit<
  Parameters<Client['ingestToken']['create']>[0],
  'organizationId' | 'instanceId' | 'name' | 'userRef'
> & { name?: string; userRef?: string };

type SourceInput = Omit<
  Parameters<Client['ingestSource']['create']>[0],
  'organizationId' | 'instanceId' | 'name' | 'family'
> & { name?: string; family?: string };

export let createOrganization = (input: OrganizationInput = {}) =>
  groundstation().organization.upsert({ ref: uniqueId('org'), ...input });

export let createProject = (organization: { id: string }, input: ProjectInput = {}) =>
  groundstation().project.upsert({
    organizationId: organization.id,
    ref: uniqueId('proj'),
    ...input
  });

export let createInstance = (
  organization: { id: string },
  project: { id: string },
  input: InstanceInput = {}
) =>
  groundstation().instance.upsert({
    organizationId: organization.id,
    projectId: project.id,
    ref: uniqueId('inst'),
    ...input
  });

export let createScope = async (input: ScopeInput = {}) => {
  let organization = await createOrganization(input.organization);
  let project = await createProject(organization, input.project);
  let instance = await createInstance(organization, project, input.instance);

  return { organization, project, instance };
};

export let createToken = async (input: TokenInput = {}, scope?: Scope) => {
  let target = scope ?? (await createScope());

  let token = await groundstation().ingestToken.create({
    organizationId: target.organization.id,
    instanceId: target.instance.id,
    name: uniqueId('laptop'),
    userRef: uniqueId('user'),
    ...(input.deviceMode == 'ephemeral' ? {} : { deviceRef: uniqueId('device') }),
    ...input
  });

  return { ...target, token, secret: token.secret };
};

export let createSource = async (input: SourceInput = {}, scope?: Scope) => {
  let target = scope ?? (await createScope());

  let source = await groundstation().ingestSource.create({
    organizationId: target.organization.id,
    instanceId: target.instance.id,
    name: uniqueId('source'),
    family: 'cursor',
    ...input
  });

  return { ...target, source, secret: source.secret };
};

export let ingest = (
  path: string,
  options: {
    credential?: string;
    method?: string;
    headers?: Record<string, string>;
    body?: BodyInit | null;
  } = {}
) =>
  fetch(`${ingestUrl()}${path}`, {
    method: options.method ?? 'POST',
    headers: {
      'content-type': 'application/json',
      ...(options.credential ? { authorization: `Bearer ${options.credential}` } : {}),
      ...options.headers
    },
    body: options.method == 'GET' ? undefined : (options.body ?? '{}')
  });

export let storedRecords = async (
  scope: { organizationId?: string; instanceId?: string },
  lane?: 'live' | 'backfill'
) => (await groundstation().records.list({ ...scope, lane })).items;

export let instanceRecords = (instance: { id: string }, lane?: 'live' | 'backfill') =>
  storedRecords({ instanceId: instance.id }, lane);

export let setSinkBusy = (busy: boolean) => groundstation().records.setBusy({ busy });

export let errorCode = async (response: Response) =>
  ((await response.json()) as { code: string }).code;

export let rpcErrorCode = async (call: Promise<unknown>) => {
  try {
    await call;
  } catch (error) {
    return (error as { data?: { code?: string } }).data?.code;
  }

  return undefined;
};
