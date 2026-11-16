export type UserEmailVerificationProvider = (d: {
  userId: string;
  email: string;
}) => Promise<boolean>;

let userEmailVerificationProviderRef: { current: UserEmailVerificationProvider } = {
  current: async () => false
};

export let setUserEmailVerificationProvider = (provider: UserEmailVerificationProvider) => {
  userEmailVerificationProviderRef.current = provider;
};

export let isUserEmailVerified = (d: { userId: string; email: string }) =>
  userEmailVerificationProviderRef.current(d);
