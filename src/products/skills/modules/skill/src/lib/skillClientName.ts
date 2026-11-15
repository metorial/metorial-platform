import { slugify } from '@lowerdeck/slugify';

export let getSkillClientNameFromTitle = (title: string) =>
  slugify(title.replaceAll('_', '-'))
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64)
    .replace(/-$/, '');
