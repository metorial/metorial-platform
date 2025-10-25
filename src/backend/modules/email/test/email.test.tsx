import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { createEmail } from '../src/templates/lib/email';

vi.mock('@react-email/components', () => ({
  render: vi.fn((component, options) => {
    if (options?.plainText) {
      return 'Plain text version';
    }
    return '<html>HTML version</html>';
  })
}));

vi.mock('../src/templates/components/wrapper', () => ({
  Wrapper: ({ children, preview }: any) => (
    <div data-preview={preview}>{children}</div>
  )
}));

describe('createEmail', () => {
  it('should create email with subject, html, and text', () => {
    const result = createEmail({
      content: <div>Test content</div>,
      subject: 'Test Subject'
    });

    expect(result).toHaveProperty('subject');
    expect(result).toHaveProperty('html');
    expect(result).toHaveProperty('text');
    expect(result.subject).toBe('Test Subject');
  });

  it('should create email with preview text', () => {
    const result = createEmail({
      content: <div>Test content</div>,
      preview: 'Preview text',
      subject: 'Test Subject'
    });

    expect(result.subject).toBe('Test Subject');
    expect(result).toHaveProperty('html');
    expect(result).toHaveProperty('text');
  });

  it('should render HTML version', async () => {
    const result = createEmail({
      content: <div>Test content</div>,
      subject: 'Test'
    });

    const html = await result.html;
    expect(html).toBe('<html>HTML version</html>');
  });

  it('should render plain text version', async () => {
    const result = createEmail({
      content: <div>Test content</div>,
      subject: 'Test'
    });

    const text = await result.text;
    expect(text).toBe('Plain text version');
  });

  it('should handle complex React content', () => {
    const ComplexContent = () => (
      <div>
        <h1>Title</h1>
        <p>Paragraph</p>
        <ul>
          <li>Item 1</li>
          <li>Item 2</li>
        </ul>
      </div>
    );

    const result = createEmail({
      content: <ComplexContent />,
      subject: 'Complex Email'
    });

    expect(result.subject).toBe('Complex Email');
    expect(result).toHaveProperty('html');
    expect(result).toHaveProperty('text');
  });

  it('should handle email without preview', () => {
    const result = createEmail({
      content: <div>Content</div>,
      subject: 'No Preview'
    });

    expect(result.subject).toBe('No Preview');
  });

  it('should handle empty string preview', () => {
    const result = createEmail({
      content: <div>Content</div>,
      preview: '',
      subject: 'Empty Preview'
    });

    expect(result.subject).toBe('Empty Preview');
  });

  it('should handle special characters in subject', () => {
    const result = createEmail({
      content: <div>Content</div>,
      subject: 'Test & <Special> "Characters"'
    });

    expect(result.subject).toBe('Test & <Special> "Characters"');
  });

  it('should handle long subjects', () => {
    const longSubject = 'A'.repeat(200);
    const result = createEmail({
      content: <div>Content</div>,
      subject: longSubject
    });

    expect(result.subject).toBe(longSubject);
    expect(result.subject.length).toBe(200);
  });

  it('should wrap content with Wrapper component', async () => {
    const render = (await import('@react-email/components')).render;

    createEmail({
      content: <div>Test</div>,
      preview: 'Preview',
      subject: 'Subject'
    });

    expect(render).toHaveBeenCalledWith(
      expect.objectContaining({
        type: expect.any(Function),
        props: expect.objectContaining({
          preview: 'Preview',
          children: expect.objectContaining({
            type: 'div'
          })
        })
      }),
      { plainText: false }
    );

    expect(render).toHaveBeenCalledWith(
      expect.anything(),
      { plainText: true }
    );
  });

  it('should handle content with props', () => {
    const ContentWithProps = ({ name }: { name: string }) => <div>Hello {name}</div>;

    const result = createEmail({
      content: <ContentWithProps name="John" />,
      subject: 'Greeting'
    });

    expect(result.subject).toBe('Greeting');
  });

  it('should handle nested React components', () => {
    const Inner = () => <span>Inner</span>;
    const Outer = () => (
      <div>
        Outer <Inner />
      </div>
    );

    const result = createEmail({
      content: <Outer />,
      subject: 'Nested'
    });

    expect(result.subject).toBe('Nested');
  });

  it('should handle fragments', () => {
    const result = createEmail({
      content: (
        <>
          <div>Part 1</div>
          <div>Part 2</div>
        </>
      ),
      subject: 'Fragment Test'
    });

    expect(result.subject).toBe('Fragment Test');
  });

  it('should handle unicode characters in subject', () => {
    const result = createEmail({
      content: <div>Content</div>,
      subject: 'Hello 世界 🌍'
    });

    expect(result.subject).toBe('Hello 世界 🌍');
  });

  it('should handle conditional rendering in content', () => {
    const showExtra = true;
    const result = createEmail({
      content: (
        <div>
          Main content
          {showExtra && <span>Extra content</span>}
        </div>
      ),
      subject: 'Conditional'
    });

    expect(result.subject).toBe('Conditional');
  });
});
