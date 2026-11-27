import { atom } from '@metorial/ui';

export let appLayoutSidebarStateAtom = atom<{
  layoutId: string | null;
  collapsed: boolean;
}>({
  layoutId: null,
  collapsed: false
});
