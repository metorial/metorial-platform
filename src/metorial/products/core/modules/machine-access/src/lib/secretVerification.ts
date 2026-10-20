export type SecretVerification = {
  token: string | null;
  dashboardSession: {
    userId: string;
    sessionId: string;
    type: 'user' | 'system';
  } | null;
};
