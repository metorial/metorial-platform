export let isAuthRoute = (
  currentUrl: string,
  auth: {
    authFrontendUrl?: string;
    loginPath: string;
    logoutPath: string;
    signupPath: string;
  }
) => {
  let current = new URL(currentUrl);
  let authOrigin = auth.authFrontendUrl || current.origin;

  return [auth.loginPath, auth.logoutPath, auth.signupPath].some(path => {
    let route = new URL(path, authOrigin);

    return route.origin == current.origin && route.pathname == current.pathname;
  });
};
