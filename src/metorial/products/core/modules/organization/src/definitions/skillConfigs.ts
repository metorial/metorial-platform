import { v } from '@lowerdeck/validation';
import { declareOrganizationConfig } from './config';

export let pinnedSkillsConfig = declareOrganizationConfig({
  identifier: 'skills.pinned',
  name: 'Pinned skills',
  ownership: 'user_organization',
  schema: v.object({
    instances: v.record(v.array(v.string()))
  }),
  default: { instances: {} }
});
