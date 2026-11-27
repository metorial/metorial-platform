import { describe, expect, it } from 'vitest';
import { detectLanguage } from './language';

describe('detectLanguage', () => {
  it('maps extensions to languages and editor modes', () => {
    expect(detectLanguage('/app/server.ts')).toMatchObject({
      id: 'typescript',
      editor: 'javascript'
    });
    expect(detectLanguage('/app/page.tsx')).toMatchObject({ id: 'tsx', editor: 'javascript' });
    expect(detectLanguage('/app/data.json')).toMatchObject({ id: 'json', editor: 'json' });
    expect(detectLanguage('/app/run.sh')).toMatchObject({ id: 'shell', editor: 'plain' });
    expect(detectLanguage('/app/config.yml')).toMatchObject({ id: 'yaml', editor: 'plain' });
  });

  it('is case-insensitive', () => {
    expect(detectLanguage('/A/README.MD').id).toBe('markdown');
  });

  it('recognises well-known file names', () => {
    expect(detectLanguage('/app/Dockerfile').id).toBe('dockerfile');
    expect(detectLanguage('/app/Makefile').id).toBe('makefile');
    expect(detectLanguage('/home/user/.bashrc').id).toBe('shell');
  });

  it('recognises dockerfile variants', () => {
    expect(detectLanguage('/app/Dockerfile.prod').id).toBe('dockerfile');
    expect(detectLanguage('/app/api.dockerfile').id).toBe('dockerfile');
  });

  it('recognises dotenv files', () => {
    expect(detectLanguage('/app/.env').id).toBe('dotenv');
    expect(detectLanguage('/app/.env.local').id).toBe('dotenv');
  });

  it('falls back to plain text', () => {
    expect(detectLanguage('/app/data.unknownext')).toMatchObject({
      id: 'plaintext',
      editor: 'plain'
    });
    expect(detectLanguage('/usr/bin/node').id).toBe('plaintext');
  });
});
