import { v } from '@lowerdeck/validation';

let artifactSchema = v.object({
  name: v.string(),
  image: v.string(),
  sourceRevision: v.string()
});

export let prepareCompose = (d: {
  config: any;
  suite: string;
  profiles: string[];
  revision: string;
  readArtifact: (name: string) => unknown;
}) => {
  let config = structuredClone(d.config);
  let applications: string[] = [];

  for (let [name, service] of Object.entries(config.services) as [string, any][]) {
    if (
      service.profiles?.length &&
      !service.profiles.some((profile: string) => d.profiles.includes(profile))
    ) {
      delete config.services[name];
      continue;
    }
    delete service.profiles;
    delete service.container_name;
    delete service.restart;

    if (
      service.build ||
      /ghcr.io\/metorial\/(forge|function-bay|signal):/.test(service.image ?? '')
    ) {
      let result = artifactSchema.validate(d.readArtifact(name));
      if (!result.success) throw new Error(`Invalid image artifact for ${name}`);
      let artifact = result.value;
      if (
        artifact.name !== name ||
        artifact.sourceRevision !== d.revision ||
        !/^ghcr\.io\/metorial\/[a-z0-9-]+@sha256:[a-f0-9]{64}$/.test(artifact.image)
      ) {
        throw new Error(`Image artifact does not match ${name} at ${d.revision}`);
      }
      service.image = artifact.image;
      delete service.build;
      delete service.volumes;
      delete service.command;
      delete service.entrypoint;
      applications.push(name);

      for (let key of ['DATABASE_URL', 'SEARCH_DATABASE_URL']) {
        if (!service.environment[key]) continue;
        let url = new URL(service.environment[key]);
        url.pathname += '-runtime';
        service.environment[key] = url.toString();
      }
      service.healthcheck = {
        test: [
          'CMD-SHELL',
          `curl -fsS http://localhost:${service.ports[0].target}/ping >/dev/null`
        ],
        interval: '5s',
        timeout: '5s',
        retries: 30,
        start_period: '10s'
      };
    }
  }

  if (!applications.includes(d.suite)) throw new Error(`No compiled image for ${d.suite}`);
  if (Object.values(config.services).some((service: any) => service.build))
    throw new Error('CI Compose must not build images');

  return { config, applications };
};
