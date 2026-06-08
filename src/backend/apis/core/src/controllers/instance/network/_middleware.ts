import { hasFlags } from '../../../middleware/hasFlags';
import { instanceGroup } from '../../../middleware/instanceGroup';

export let networkInstanceGroup = instanceGroup.use(
  hasFlags(['networking-enabled', 'paid-networking'])
);
