import { describe, expect, it } from 'vitest';
import { htmlDecode, htmlEncode } from './htmlEncode';

describe('htmlEncode', () => {
  it('encodes and decodes html entities', () => {
    let raw = `<script>alert("xss")</script>`;
    let encoded = htmlEncode(raw);

    expect(encoded).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    );
    expect(htmlDecode(encoded)).toBe(raw);
  });
});
