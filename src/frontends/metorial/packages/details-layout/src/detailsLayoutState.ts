export let DETAILS_LAYOUT_COLLAPSE_SCROLL_TOP = 200;

export let getDetailsPathname = (to?: string) => {
  if (!to) return null;

  try {
    return new URL(to, 'http://metorial.local').pathname.replace(/\/$/, '') || '/';
  } catch {
    return to.replace(/[?#].*$/, '').replace(/\/$/, '') || '/';
  }
};

export let isDetailsMainPage = ({
  pathname,
  mainPageTo
}: {
  pathname: string;
  mainPageTo?: string;
}) => getDetailsPathname(pathname) == getDetailsPathname(mainPageTo);

export let shouldExpandDetailsHeader = ({
  pathname,
  mainPageTo,
  scrollTop
}: {
  pathname: string;
  mainPageTo?: string;
  scrollTop: number;
}) =>
  isDetailsMainPage({ pathname, mainPageTo }) &&
  scrollTop <= DETAILS_LAYOUT_COLLAPSE_SCROLL_TOP;
