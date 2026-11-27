// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { HtmlElement, parseHtmlBody } from './htmlDom';
import { elementMatches, parseSelector } from './htmlSelector';

let body = (html: string) => parseHtmlBody(html);

describe('html selector matching', () => {
  it('matches type selectors case-insensitively', () => {
    let [p] = body('<p>x</p>').children;

    expect(elementMatches(p!, 'p')).toBe(true);
    expect(elementMatches(p!, 'P')).toBe(true);
    expect(elementMatches(p!, 'div')).toBe(false);
    expect(elementMatches(p!, '*')).toBe(true);
  });

  it('matches attribute presence and equality', () => {
    let [div] = body('<div data-callout-type="info" data-x></div>').children;

    expect(elementMatches(div!, 'div[data-callout-type]')).toBe(true);
    expect(elementMatches(div!, 'div[data-callout-type="info"]')).toBe(true);
    expect(elementMatches(div!, "div[data-callout-type='info']")).toBe(true);
    expect(elementMatches(div!, 'div[data-callout-type=info]')).toBe(true);
    expect(elementMatches(div!, 'div[data-callout-type="warning"]')).toBe(false);
    expect(elementMatches(div!, '[data-x]')).toBe(true);
    expect(elementMatches(div!, 'div[data-missing]')).toBe(false);
  });

  it('matches class selectors against token lists', () => {
    let [li] = body(
      '<ul class="a contains-task-list b"><li class="task-list-item">x</li></ul>'
    ).children;

    expect(elementMatches(li!, '.contains-task-list')).toBe(true);
    expect(elementMatches(li!, 'ul.a.b')).toBe(true);
    expect(elementMatches(li!, '.contains')).toBe(false);
  });

  it('supports child and descendant combinators', () => {
    let table = body(
      '<table><colgroup><col width="1"></colgroup><tr><td><p>x</p></td></tr></table>'
    ).children[0]!;

    expect(table.querySelectorAll('colgroup > col')).toHaveLength(1);
    expect(table.querySelectorAll('table col')).toHaveLength(1);
    expect(table.querySelectorAll('table > col')).toHaveLength(0);
    expect(table.querySelectorAll('tr td p')).toHaveLength(1);
    expect(table.querySelectorAll('tr > p')).toHaveLength(0);
  });

  it('supports selector lists', () => {
    let root = body('<h1>a</h1><h2>b</h2><p>c</p>');

    expect(root.querySelectorAll('h1,h2')).toHaveLength(2);
    expect(root.querySelectorAll('h1 , p')).toHaveLength(2);
  });

  it('keeps commas and spaces inside attribute values intact', () => {
    let [div] = body('<div title="a, b > c"></div>').children;

    expect(elementMatches(div!, 'div[title="a, b > c"]')).toBe(true);
  });

  it('rejects selectors it cannot evaluate instead of guessing', () => {
    for (let selector of [':not(p)', 'p:first-child', 'p + p', 'p ~ p', '[a^="b"]', '', '>']) {
      expect(() => parseSelector(selector), selector).toThrow();
    }
  });

  it('supports every selector the schema parse rules and normalizer use', () => {
    for (let selector of [
      'p',
      'img[src]',
      'ul[data-type="taskList"]',
      'li[data-type="taskItem"]',
      'div[data-callout-type]',
      'div[data-equation-block]',
      'colgroup > col',
      '.contains-task-list',
      '.task-list-item',
      'span[data-comment-thread]'
    ]) {
      expect(() => parseSelector(selector), selector).not.toThrow();
    }
  });

  it('finds the closest matching ancestor including itself', () => {
    let cell = body('<table><tr><td><b>x</b></td></tr></table>').querySelector('b')!;

    expect(cell.closest('table')?.localName).toBe('table');
    expect(cell.closest('b')).toBe(cell);
    expect(cell.closest('pre')).toBeNull();
    expect(cell instanceof HtmlElement).toBe(true);
  });
});
