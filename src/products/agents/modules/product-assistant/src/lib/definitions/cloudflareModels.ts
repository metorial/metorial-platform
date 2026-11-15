import { createReviewModels, type ReviewModel } from '@metorial/review-engine';
import { env } from '../../env';

if (!!env.models.CLOUDFLARE_AI_API_TOKEN != !!env.models.CLOUDFLARE_ACCOUNT_ID) {
  console.warn(
    'Product assistant: CLOUDFLARE_AI_API_TOKEN and CLOUDFLARE_ACCOUNT_ID must both be set to use Cloudflare'
  );
}

export let cloudflareChatModel: ReviewModel | null =
  env.models.CLOUDFLARE_AI_API_TOKEN && env.models.CLOUDFLARE_ACCOUNT_ID
    ? (createReviewModels({
        cloudflare: {
          accountId: env.models.CLOUDFLARE_ACCOUNT_ID,
          apiToken: env.models.CLOUDFLARE_AI_API_TOKEN
        }
      })?.balanced ?? null)
    : null;
