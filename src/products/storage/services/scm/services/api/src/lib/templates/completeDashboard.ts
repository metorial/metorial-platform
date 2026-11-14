import { scmResultHtml } from './scmResult';

export let completeDashboardHtml = (redirectUrl?: string | null) =>
  scmResultHtml({ kind: 'succeeded', redirectUrl });
