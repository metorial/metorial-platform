import { createContext, useContext } from 'react';

export type SecurityReviewFlagsOverride = {
  skillsEnabled: boolean;
  reviewsEnabled: boolean;
  canGenerate: boolean;
};

let SecurityReviewFlagsContext = createContext<SecurityReviewFlagsOverride | null>(null);

export let SecurityReviewFlagsProvider = SecurityReviewFlagsContext.Provider;

export let useSecurityReviewFlagsOverride = () => useContext(SecurityReviewFlagsContext);
