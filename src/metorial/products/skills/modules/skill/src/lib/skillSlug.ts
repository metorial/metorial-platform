import { generatePlainId } from '@lowerdeck/id';
import { slugify } from '@lowerdeck/slugify';

export let getSkillSlug = (name: string) =>
  `${slugify(name)}-${generatePlainId(5).toLowerCase()}`;
