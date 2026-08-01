export interface Context {
  ua: string;
  ip: string;
}

export let getRequestContext = (c: {
  req: { header: (name: string) => string | undefined };
}): Context => ({
  ip: (c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? '')
    .split(',')[0]!
    .trim(),
  ua: c.req.header('user-agent') ?? ''
});
