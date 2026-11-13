import { f } from '@metorial/data-list';

export let skillViewQueryKey = 'view';

export let skillViews = [
  { id: 'favorites', label: 'Favorites' },
  { id: 'mine', label: 'Your Skills' },
  { id: 'templates', label: 'Templates' }
] as const;

export type SkillView = (typeof skillViews)[number]['id'];

export let skillViewFilter = (opts: { withTemplates?: boolean } = {}) =>
  f.select(
    skillViewQueryKey,
    'View',
    opts.withTemplates === false
      ? skillViews.filter(view => view.id != 'templates')
      : skillViews,
    {
      description: 'Filter by view',
      highlight: { exclusive: true, hideLabel: true, preserveOrder: true }
    }
  );

export let isOwnedSkillsView = () =>
  new URLSearchParams(window.location.search).get(skillViewQueryKey) == 'mine';
