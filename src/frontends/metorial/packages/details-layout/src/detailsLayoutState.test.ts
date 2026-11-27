import { describe, expect, it } from 'vitest';
import {
  DETAILS_LAYOUT_COLLAPSE_SCROLL_TOP,
  getDetailsPathname,
  isDetailsMainPage,
  shouldExpandDetailsHeader
} from './detailsLayoutState';

describe('details layout state', () => {
  it('normalizes absolute URLs, query strings, hashes, and trailing slashes', () => {
    expect(
      getDetailsPathname('https://dashboard.metorial.com/chats/example/?tab=one#top')
    ).toBe('/chats/example');
    expect(getDetailsPathname('/chats/example/')).toBe('/chats/example');
    expect(getDetailsPathname('/')).toBe('/');
    expect(getDetailsPathname()).toBeNull();
  });

  it('only treats an exact final breadcrumb match as the main page', () => {
    expect(
      isDetailsMainPage({
        pathname: '/chats/example',
        mainPageTo: '/chats/example/'
      })
    ).toBe(true);
    expect(
      isDetailsMainPage({
        pathname: '/chats/example/events',
        mainPageTo: '/chats/example'
      })
    ).toBe(false);
    expect(
      isDetailsMainPage({
        pathname: '/chats/example/events',
        mainPageTo: '/chats/example/events'
      })
    ).toBe(true);
  });

  it('expands through 200 pixels on the final breadcrumb page and collapses beyond it', () => {
    let state = {
      pathname: '/chats/example',
      mainPageTo: '/chats/example'
    };

    expect(
      shouldExpandDetailsHeader({
        ...state,
        scrollTop: DETAILS_LAYOUT_COLLAPSE_SCROLL_TOP
      })
    ).toBe(true);
    expect(
      shouldExpandDetailsHeader({
        ...state,
        scrollTop: DETAILS_LAYOUT_COLLAPSE_SCROLL_TOP + 1
      })
    ).toBe(false);
    expect(
      shouldExpandDetailsHeader({
        pathname: '/chats/example/events',
        mainPageTo: '/chats/example',
        scrollTop: DETAILS_LAYOUT_COLLAPSE_SCROLL_TOP
      })
    ).toBe(false);
  });
});
