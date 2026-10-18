import { describe, expect, it } from 'vitest';
import { isGoodScore, pickBestCandidate, scoreCandidate } from '../src/lib/rank';

let candidate = (
  overrides: Partial<PrismaJson.WebImageCandidate>
): PrismaJson.WebImageCandidate => ({
  url: 'https://example.com/icon.png',
  source: 'icon',
  declaredWidth: null,
  declaredHeight: null,
  width: null,
  height: null,
  format: null,
  bytes: null,
  score: null,
  rejectedReason: null,
  ...overrides
});

let score = (overrides: Partial<PrismaJson.WebImageCandidate>) =>
  scoreCandidate(candidate(overrides)).score;

describe('scoreCandidate', () => {
  it('rejects raster images that are too small', () => {
    expect(scoreCandidate(candidate({ width: 16, height: 16, format: 'png' }))).toEqual({
      score: null,
      rejectedReason: 'too_small'
    });
  });

  it('ranks a large square apple touch icon as good', () => {
    expect(
      isGoodScore(
        score({ source: 'apple_touch_icon', width: 180, height: 180, format: 'png' })!
      )
    ).toBe(true);
  });

  it('ranks svg icons above raster icons', () => {
    expect(score({ source: 'svg_icon', format: 'svg' })!).toBeGreaterThan(
      score({ source: 'icon', width: 512, height: 512, format: 'png' })!
    );
  });

  it('ranks small favicons below large square icons', () => {
    expect(score({ source: 'icon', width: 32, height: 32, format: 'ico' })!).toBeLessThan(
      score({ source: 'apple_touch_icon', width: 180, height: 180, format: 'png' })!
    );
  });

  it('ranks wide social banners below square icons', () => {
    let banner = score({ source: 'og_image', width: 1200, height: 630, format: 'jpeg' })!;

    expect(banner).toBeLessThan(
      score({ source: 'icon', width: 64, height: 64, format: 'png' })!
    );
    expect(isGoodScore(banner)).toBe(false);
  });

  it('uses declared sizes before an image is verified', () => {
    expect(score({ source: 'icon', declaredWidth: 16, declaredHeight: 16 })).toBeNull();
    expect(
      score({ source: 'icon', declaredWidth: 192, declaredHeight: 192 })!
    ).toBeGreaterThan(score({ source: 'icon', declaredWidth: 48, declaredHeight: 48 })!);
  });
});

describe('pickBestCandidate', () => {
  it('ignores unverified and rejected candidates', () => {
    let unverified = candidate({ url: 'https://a.com/1.png', score: 99 });
    let rejected = candidate({
      url: 'https://a.com/2.png',
      score: 99,
      format: 'png',
      rejectedReason: 'not_an_image'
    });

    expect(
      pickBestCandidate([
        { pageIndex: 0, candidate: unverified },
        { pageIndex: 0, candidate: rejected }
      ])
    ).toBeNull();
  });

  it('prefers the more specific page when scores tie', () => {
    let specific = candidate({ url: 'https://a.com/1.png', score: 70, format: 'png' });
    let parent = candidate({ url: 'https://b.com/1.png', score: 70, format: 'png' });

    expect(
      pickBestCandidate([
        { pageIndex: 2, candidate: parent },
        { pageIndex: 0, candidate: specific }
      ])?.candidate.url
    ).toBe('https://a.com/1.png');
  });

  it('prefers a clearly better icon on a parent page', () => {
    let specific = candidate({ url: 'https://a.com/1.png', score: 50, format: 'ico' });
    let parent = candidate({ url: 'https://b.com/1.svg', score: 100, format: 'svg' });

    expect(
      pickBestCandidate([
        { pageIndex: 0, candidate: specific },
        { pageIndex: 3, candidate: parent }
      ])?.candidate.url
    ).toBe('https://b.com/1.svg');
  });
});
