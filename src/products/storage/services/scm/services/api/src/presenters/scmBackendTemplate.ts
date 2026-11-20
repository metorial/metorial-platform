import type { ScmBackendTemplate } from '../../prisma/generated/client';
import { env } from '../env';
import { hasTemplateSecret } from '../lib/scmCredentials';

let callbackPaths = {
  github: '/origin/oauth/github/callback',
  gitlab: '/origin/oauth/gitlab/callback',
  bitbucket: '/origin/oauth/bitbucket/callback'
};

let providerFor = (type: ScmBackendTemplate['type']): keyof typeof callbackPaths =>
  type === 'github' || type === 'github_enterprise'
    ? 'github'
    : type === 'gitlab' || type === 'gitlab_selfhosted'
      ? 'gitlab'
      : 'bitbucket';

export let scmBackendTemplatePresenter = (template: ScmBackendTemplate) => {
  let provider = providerFor(template.type);
  let publicUrl = env.service.ORIGIN_SERVICE_PUBLIC_URL;

  return {
    object: 'origin#scmBackendTemplate' as const,
    id: template.id,
    status: template.status,
    type: template.type,
    provider,
    name: template.name,
    description: template.description,
    apiUrl: template.apiUrl,
    webUrl: template.webUrl,
    appId: template.appId,
    appSlug: template.appSlug,
    clientId: template.clientId,
    hasClientSecret: hasTemplateSecret(template, 'clientSecret'),
    hasAppPrivateKey: hasTemplateSecret(template, 'appPrivateKey'),
    hasAppWebhookSecret: hasTemplateSecret(template, 'appWebhookSecret'),
    oauthCallbackUrl: `${publicUrl}${callbackPaths[provider]}`,
    appWebhookUrl:
      provider === 'github'
        ? `${publicUrl}/origin/webhook-ingest/github-app-template/${template.id}`
        : null,
    version: template.version,
    secretVersion: template.secretVersion,
    archivedAt: template.archivedAt,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt
  };
};
