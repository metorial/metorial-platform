export type ControlPortService =
  'redis' | 'nats' | 'mongo' | 'postgres' | 'etcd_client' | 'etcd_peer' | 'mail' | 'mail_ui';

type Interpolation = string | number;

let render = (strings: TemplateStringsArray, values: Interpolation[]) =>
  strings.reduce(
    (out, part, index) => out + part + (index < values.length ? values[index] : ''),
    ''
  );

export let t = Object.assign(
  (strings: TemplateStringsArray, ...values: Interpolation[]) => render(strings, values),
  {
    hostname: '{{HOSTNAME}}',
    port: '{{PORT}}',
    bindPort: '{{BIND_PORT}}',
    controlPort: (service: ControlPortService) => `{{CONTROL_PORT_${service.toUpperCase()}}}`
  }
);
