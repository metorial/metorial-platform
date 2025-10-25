import { describe, expect, it } from 'vitest';
import { createTemplate, ITemplate } from '../src/templates/template';

describe('createTemplate', () => {
  it('should return the template object as-is', () => {
    const mockTemplate: ITemplate<{ name: string }> = {
      render: async (data) => ({
        subject: `Hello ${data.name}`,
        html: `<p>Hello ${data.name}</p>`,
        text: `Hello ${data.name}`
      })
    };

    const result = createTemplate(mockTemplate);

    expect(result).toBe(mockTemplate);
    expect(result).toHaveProperty('render');
  });

  it('should preserve render function', async () => {
    const mockTemplate: ITemplate<{ count: number }> = {
      render: async (data) => ({
        subject: `Count: ${data.count}`,
        html: `<p>Count: ${data.count}</p>`,
        text: `Count: ${data.count}`
      })
    };

    const result = createTemplate(mockTemplate);
    const rendered = await result.render({ count: 42 });

    expect(rendered).toEqual({
      subject: 'Count: 42',
      html: '<p>Count: 42</p>',
      text: 'Count: 42'
    });
  });

  it('should work with synchronous render function', async () => {
    const mockTemplate: ITemplate<{}> = {
      render: () => ({
        subject: 'Test',
        html: '<p>Test</p>',
        text: 'Test'
      })
    };

    const result = createTemplate(mockTemplate);
    const rendered = await result.render({});

    expect(rendered).toEqual({
      subject: 'Test',
      html: '<p>Test</p>',
      text: 'Test'
    });
  });

  it('should work with async render function', async () => {
    const mockTemplate: ITemplate<{ delay: number }> = {
      render: async (data) => {
        await new Promise((resolve) => setTimeout(resolve, data.delay));
        return {
          subject: 'Async Test',
          html: '<p>Async Test</p>',
          text: 'Async Test'
        };
      }
    };

    const result = createTemplate(mockTemplate);
    const rendered = await result.render({ delay: 10 });

    expect(rendered).toEqual({
      subject: 'Async Test',
      html: '<p>Async Test</p>',
      text: 'Async Test'
    });
  });

  it('should work with complex data types', async () => {
    interface ComplexData {
      user: {
        name: string;
        email: string;
      };
      items: string[];
      metadata: Record<string, any>;
    }

    const mockTemplate: ITemplate<ComplexData> = {
      render: async (data) => ({
        subject: `Hello ${data.user.name}`,
        html: `<p>${data.items.join(', ')}</p>`,
        text: JSON.stringify(data.metadata)
      })
    };

    const result = createTemplate(mockTemplate);
    const rendered = await result.render({
      user: { name: 'John', email: 'john@example.com' },
      items: ['a', 'b', 'c'],
      metadata: { key: 'value' }
    });

    expect(rendered.subject).toBe('Hello John');
    expect(rendered.html).toBe('<p>a, b, c</p>');
    expect(rendered.text).toBe('{"key":"value"}');
  });

  it('should work with empty data type', async () => {
    const mockTemplate: ITemplate<{}> = {
      render: async () => ({
        subject: 'Empty Data',
        html: '<p>Empty</p>',
        text: 'Empty'
      })
    };

    const result = createTemplate(mockTemplate);
    const rendered = await result.render({});

    expect(rendered).toEqual({
      subject: 'Empty Data',
      html: '<p>Empty</p>',
      text: 'Empty'
    });
  });

  it('should handle render function that returns promises for html and text', async () => {
    const mockTemplate: ITemplate<{ name: string }> = {
      render: async (data) => ({
        subject: `Hello ${data.name}`,
        html: Promise.resolve(`<p>Hello ${data.name}</p>`),
        text: Promise.resolve(`Hello ${data.name}`)
      })
    };

    const result = createTemplate(mockTemplate);
    const rendered = await result.render({ name: 'Alice' });

    expect(rendered.subject).toBe('Hello Alice');
    expect(await rendered.html).toBe('<p>Hello Alice</p>');
    expect(await rendered.text).toBe('Hello Alice');
  });

  it('should preserve template identity for type checking', () => {
    const mockTemplate: ITemplate<{ value: number }> = {
      render: async (data) => ({
        subject: String(data.value),
        html: String(data.value),
        text: String(data.value)
      })
    };

    const result = createTemplate(mockTemplate);

    // This ensures TypeScript type checking is preserved
    expect(result satisfies ITemplate<{ value: number }>).toBeDefined();
  });
});
