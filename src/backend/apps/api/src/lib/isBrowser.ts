export let isBrowser = (request: Request) => {
  if (request.headers.has('origin')) return true;

  let ua = request.headers.get('user-agent');
  if (!ua) return false;

  return ua.includes('Mozilla') || ua.includes('AppleWebKit');
};
