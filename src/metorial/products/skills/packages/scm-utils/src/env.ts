import { defineSettings } from '@metorial/settings';
import { v } from '@lowerdeck/validation';

export let getSkillsScmUtilsEnv = () =>
  defineSettings({
    origin: {
      ORIGIN_URL: v.string()
    }
  });
