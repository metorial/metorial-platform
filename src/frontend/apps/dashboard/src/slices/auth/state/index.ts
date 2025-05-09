import { useMutation } from '@metorial/data-hooks';
import { withDashboardSDK } from '@metorial/state/src/sdk';

let login = (d: { email: string; password: string }) =>
  withDashboardSDK(sdk => sdk.auth.login(d));
let signup = (d: { email: string; password: string; name: string }) =>
  withDashboardSDK(sdk => sdk.auth.signup(d));
let logout = () => withDashboardSDK(sdk => sdk.auth.logout());

export let useLogin = () => useMutation(login);
export let useSignup = () => useMutation(signup);
export let useLogout = () => useMutation(logout);
