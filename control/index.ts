import { rootProject, stack } from '@metorial/control';

export default rootProject({
  mode: 'oss',
  stacks: [
    stack({
      id: 'on-prem',
      edition: 'on-prem',
      label: 'On-premises',
      description: 'The self-hosted distribution'
    })
  ]
});
