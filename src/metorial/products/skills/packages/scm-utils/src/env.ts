import { defineSettings } from '@metorial/settings';
import { serviceUrl } from '@metorial/shared-settings';
import { v } from '@lowerdeck/validation';

export let getSkillsScmUtilsEnv = () =>
  defineSettings({
    origin: {
      ORIGIN_URL: serviceUrl('origin')
    }
  });
