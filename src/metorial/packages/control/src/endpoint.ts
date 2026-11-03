import type { RawEndpoint, Template } from './types';

export class EndpointDefinition {
  constructor(readonly spec: RawEndpoint) {}

  private with(patch: Partial<RawEndpoint>) {
    return new EndpointDefinition({ ...this.spec, ...patch });
  }

  health(path: string, status?: number) {
    return this.with({ health: status === undefined ? path : { path, status } });
  }

  protocol(protocol: 'http' | 'h2c') {
    return this.with({ protocol });
  }

  env(key: string, value: Template) {
    return this.with({ env: [...(this.spec.env ?? []), { key, value }] });
  }

  listenEnv(key: string, value: Template = '{{BIND_PORT}}') {
    return this.env(key, value);
  }

  link(link: NonNullable<RawEndpoint['link']>) {
    return this.with({ link });
  }

  url(path = ''): Template {
    return `http://{{HOSTNAME}}:${this.spec.port}${path}`;
  }

  wsUrl(path = ''): Template {
    return `ws://{{HOSTNAME}}:${this.spec.port}${path}`;
  }

  host(): Template {
    return `{{HOSTNAME}}:${this.spec.port}`;
  }

  get port() {
    return this.spec.port;
  }

  toRaw(): RawEndpoint {
    return this.spec;
  }
}

export let endpoint = (port: number) => new EndpointDefinition({ port });
