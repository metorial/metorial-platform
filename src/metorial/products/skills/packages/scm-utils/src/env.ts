import { createValidatedEnv } from '@lowerdeck/env';
import { v } from '@lowerdeck/validation';

export let getSkillsScmUtilsEnv = () =>
  createValidatedEnv({
    origin: {
      ORIGIN_URL: v.string()
    }
  });
