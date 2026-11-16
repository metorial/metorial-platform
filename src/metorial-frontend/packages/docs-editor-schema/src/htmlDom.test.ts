// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  HtmlDepthError,
  HtmlElement,
  HtmlText,
  parseHtmlBody,
  reparseHtmlBody
} from './htmlDom';

describe('html dom', () => {
  it('parses markup into a navigable tree', () => {
    let body = parseHtmlBody('<p>a <b>b</b> c</p><p>d</p>');
    let [first, second] = body.children;

    expect(body.children).toHaveLength(2);
    expect(first!.textContent).toBe('a b c');
    expect(first!.firstChild).toBeInstanceOf(HtmlText);
    expect(first!.nextSibling).toBe(second);
    expect(second!.previousSibling).toBe(first);
    expect(second!.nextSibling).toBeNull();
    expect(first!.parentNode).toBe(body);
  });

  it('exposes standard dom surface used by the schema attribute parsers', () => {
    let body = parseHtmlBody(
      '<table><tr><td colspan="2" style="text-align: Center; color:red" class="x y" data-k="v">c</td></tr></table>'
    );
    let element = body.querySelector('td')!;

    expect(element.tagName).toBe('TD');
    expect(element.nodeName).toBe('TD');
    expect(element.nodeType).toBe(1);
    expect(element.getAttribute('colspan')).toBe('2');
    expect(element.getAttribute('COLSPAN')).toBe('2');
    expect(element.getAttribute('missing')).toBeNull();
    expect(element.hasAttribute('data-k')).toBe(true);
    expect(element.style.textAlign).toBe('Center');
    expect(element.style.color).toBe('red');
    expect(element.style.fontWeight).toBe('');
    expect(element.style.length).toBe(2);
    expect(element.style.item(0)).toBe('text-align');
    expect(element.style.getPropertyValue('color')).toBe('red');
    expect([...element.classList]).toEqual(['x', 'y']);
    expect(element.classList.contains('y')).toBe(true);
    expect(element.ownerDocument.createTextNode('\n').nodeType).toBe(3);
  });

  it('splits class tokens on ascii whitespace only', () => {
    let element = parseHtmlBody('<p class="a\u00a0b  c\td">x</p>').querySelector('p')!;

    expect([...element.classList]).toEqual(['a\u00a0b', 'c', 'd']);
    expect(element.matches('.c')).toBe(true);
    expect(element.matches('.b')).toBe(false);
  });

  it('applies html5 parsing rules for malformed markup', () => {
    let body = parseHtmlBody('<table><tr><td>x</td></tr></table>');

    expect(body.querySelectorAll('tbody')).toHaveLength(1);
    expect(parseHtmlBody('<p>a<p>b').children).toHaveLength(2);
  });

  it('foster-parents text inside tables in front of the table', () => {
    let body = parseHtmlBody('<table>stray<tr><td>x</td></tr></table>');

    expect(body.firstChild).toBeInstanceOf(HtmlText);
    expect(body.firstChild!.textContent).toBe('stray');
    expect(body.children[0]!.localName).toBe('table');
  });

  it('does not execute or special-case scripts', () => {
    let body = parseHtmlBody('<script>window.x = 1</script><noscript><p>n</p></noscript>');

    expect(body.querySelector('script')!.textContent).toBe('window.x = 1');
    expect(body.querySelector('noscript p')).not.toBeNull();
  });

  it('keeps comments out of element children and text content', () => {
    let body = parseHtmlBody('<p>a<!-- hidden -->b</p>');

    expect(body.querySelector('p')!.textContent).toBe('ab');
    expect(body.querySelector('p')!.childNodes.map(node => node.nodeType)).toEqual([3, 8, 3]);
  });

  it('keeps sibling links consistent through mutation', () => {
    let body = parseHtmlBody('<p>1</p><p>2</p><p>3</p>');
    let [a, b, c] = body.children;

    body.removeChild(b!);
    expect(a!.nextSibling).toBe(c);
    expect(c!.previousSibling).toBe(a);

    body.insertBefore(b!, a!);
    expect(body.firstChild).toBe(b);
    expect(b!.nextSibling).toBe(a);
    expect(body.children.map(child => child.textContent)).toEqual(['2', '1', '3']);

    c!.remove();
    expect(body.lastChild).toBe(a);
    expect(c!.parentNode).toBeNull();
    expect(body.contains(a!)).toBe(true);
    expect(body.contains(c!)).toBe(false);
  });

  it('invalidates cached queries when the tree or attributes change', () => {
    let body = parseHtmlBody('<p class="a">1</p><p>2</p>');

    expect(body.querySelectorAll('.a')).toHaveLength(1);
    expect(body.querySelectorAll('p')).toHaveLength(2);

    body.children[1]!.setAttribute('class', 'a');
    expect(body.querySelectorAll('.a')).toHaveLength(2);

    body.children[0]!.remove();
    expect(body.querySelectorAll('.a')).toHaveLength(1);
    expect(body.querySelectorAll('p')).toHaveLength(1);

    body.appendChild(new HtmlElement('p'));
    expect(body.querySelectorAll('p')).toHaveLength(2);
  });

  it('does not let callers corrupt cached query results', () => {
    let body = parseHtmlBody('<p>1</p><p>2</p>');

    body.querySelectorAll('p').pop();

    expect(body.querySelectorAll('p')).toHaveLength(2);
  });

  it('moves a node when it is inserted elsewhere', () => {
    let body = parseHtmlBody('<div><b>x</b></div><p>y</p>');
    let b = body.querySelector('b')!;

    body.querySelector('p')!.appendChild(b);

    expect(body.querySelector('div b')).toBeNull();
    expect(body.querySelector('p b')).toBe(b);
  });

  it('round-trips through serialization without losing structure or escaping', () => {
    let body = parseHtmlBody(
      '<p title="a &quot;q&quot; &amp; b">1 &lt; 2 &amp; 3 &nbsp;x</p>'
    );
    let reparsed = reparseHtmlBody(body);
    let p = reparsed.querySelector('p')!;

    expect(p.getAttribute('title')).toBe('a "q" & b');
    expect(p.textContent).toBe('1 < 2 & 3  x');
  });

  it('drops layout-only newline text nodes when reparsing', () => {
    let body = parseHtmlBody('<ul>\n<li>a</li>\n</ul>\n');
    let reparsed = reparseHtmlBody(body);

    expect(
      reparsed.querySelector('ul')!.childNodes.every(node => node instanceof HtmlElement)
    ).toBe(true);
  });

  it('rejects markup nested beyond the depth limit', () => {
    let deep = '<div>'.repeat(400);

    expect(() => parseHtmlBody(deep)).toThrow(HtmlDepthError);
  });

  it('accepts markup at a reasonable depth', () => {
    expect(() => parseHtmlBody('<div>'.repeat(100) + 'x')).not.toThrow();
  });

  it('keeps svg elements in their own namespace', () => {
    let svg = parseHtmlBody('<svg><circle r="1"></circle></svg>').querySelector('svg')!;

    expect(svg.namespaceURI).toBe('http://www.w3.org/2000/svg');
  });
});
