import { createBaseConfigHook } from '../../config/createBaseConfigHook';
import { createInstanceScopedConfigHook } from '../../config/createScopedConfigHooks';
import { createSetConfigHook } from '../../config/createSetConfigHook';

export let useInstancePinnedSkills = createSetConfigHook(
  createInstanceScopedConfigHook(createBaseConfigHook('skills.pinned'), 'instances')
);
