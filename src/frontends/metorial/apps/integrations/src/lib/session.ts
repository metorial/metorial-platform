import type { Session } from '../state/types';

export let isAdminSession = (session: Pick<Session, 'type' | 'typeConcrete'>) =>
  (session.typeConcrete ?? session.type) === 'admin';
