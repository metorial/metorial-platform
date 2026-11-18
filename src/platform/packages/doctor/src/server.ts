import {
  check,
  createDoctor,
  describeError,
  type CheckDefinition,
  type Doctor
} from '@lowerdeck/doctor';
import { attachDoctor, doctorFingerprints, registerDoctorChecks } from './registry';

let defaultHealthPorts = [12121];
let doctorPath = '/doctor';
let listening = false;

export interface HealthServerOptions {
  component: string;
  liveness: (req: Request) => Response | Promise<Response>;
  checks?: CheckDefinition[];
  ports?: number[];
  publicUrl?: string | null;
  env?: Record<string, string | undefined>;
}

export interface HealthServer {
  doctor: Doctor;
  ports: number[];
  fetch: (req: Request) => Promise<Response>;
  stop: () => void;
}

export let resolveHealthPorts = (
  env: Record<string, string | undefined>,
  productionPorts: number[] = defaultHealthPorts
) => {
  if (env.HEALTH_PORT) return [Number(env.HEALTH_PORT)];
  return env.NODE_ENV === 'production' ? productionPorts : [];
};

// `/` and every other path keep the plain liveness answer the probes rely on; only `/doctor`
// is new. The doctor exists even when nothing listens, so registrations always have a target.
export let startHealthServer = (options: HealthServerOptions): HealthServer => {
  let env = options.env ?? process.env;
  let doctor = createDoctor({
    component: options.component,
    publicUrl: options.publicUrl ?? env.METORIAL_PUBLIC_URL ?? null,
    fingerprints: doctorFingerprints(),
    checks: options.checks ?? []
  });
  attachDoctor(doctor);

  let fetch = async (req: Request) => {
    if (new URL(req.url).pathname == doctorPath) return doctor.handler(req);
    return options.liveness(req);
  };

  let ports = resolveHealthPorts(env, options.ports);
  let servers = ports.map(port => Bun.serve({ port, fetch }));
  if (servers.length) listening = true;

  return {
    doctor,
    ports: servers.map(server => server.port ?? 0),
    fetch,
    stop: () => {
      for (let server of servers) server.stop(true);
    }
  };
};

export let bootFailureCheck = (component: string, error: unknown) => {
  let described = describeError(error);

  return check({
    id: 'runtime.boot',
    title: 'The component started',
    category: 'runtime',
    severity: 'critical',
    run: ctx =>
      ctx.fail({
        message: `${component} failed to start: ${described.message}`,
        resolution: {
          summary: 'Fix the cause below, then restart the component.',
          docs: 'datacenter/operations/doctor#startup-failures'
        },
        details: { error: described.message }
      })
  });
};

export let startBootFailureServer = (
  component: string,
  error: unknown,
  options: Pick<HealthServerOptions, 'ports' | 'publicUrl' | 'env' | 'checks'> = {}
): HealthServer =>
  startHealthServer({
    ...options,
    component,
    checks: [bootFailureCheck(component, error), ...(options.checks ?? [])],
    liveness: () => new Response('Service Unavailable', { status: 503 })
  });

// A component that fails while booting would otherwise exit before anything can ask it why. The
// startup probe keeps the pod alive for a while, so /doctor answers with the failure meanwhile.
export let handleBootFailure = (
  component: string,
  error: unknown,
  options: Parameters<typeof startBootFailureServer>[2] = {}
) => {
  console.error(error);

  if (listening) {
    registerDoctorChecks(bootFailureCheck(component, error));
    return;
  }

  let env = options.env ?? process.env;
  if (!resolveHealthPorts(env, options.ports).length) process.exit(1);

  try {
    startBootFailureServer(component, error, options);
  } catch {
    process.exit(1);
  }
};
