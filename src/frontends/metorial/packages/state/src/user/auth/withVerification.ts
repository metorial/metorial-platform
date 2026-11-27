export type VerifiedRequestOptions = { headers?: Record<string, string> };

export let withVerification = <O>(
  fn: (opts?: VerifiedRequestOptions) => Promise<O>
): Promise<O> => {
  let enterpriseWithVerification =
    typeof window == 'undefined' ? undefined : (window as any).enterpriseWithVerification;

  return enterpriseWithVerification ? enterpriseWithVerification(fn) : fn();
};
