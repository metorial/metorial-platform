import { describe, expect, it } from 'vitest';
import { getFunctionFs } from './getFs';

let getFile = (
  res: Extract<ReturnType<typeof getFunctionFs>, { ok: true }>,
  filename: string
) => res.files.find(file => file.filename === filename);

let payload = (
  files: PrismaJson.UpcomingFunctionServerPayload['files']
): PrismaJson.UpcomingFunctionServerPayload => ({
  runtime: { identifier: 'nodejs', version: '24.x' },
  env: {},
  files
});

describe('getFunctionFs', () => {
  it('removes module package type while preserving main entrypoint detection', () => {
    let res = getFunctionFs({
      payload: payload([
        {
          filename: 'package.json',
          content: JSON.stringify({
            name: 'custom-provider',
            type: 'module',
            main: 'src/index.ts'
          })
        },
        {
          filename: 'src/index.ts',
          content: 'export default {};'
        }
      ])
    });

    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error('Expected function fs to be valid');

    expect(getFile(res, 'shuttle_entry_point.js')?.content).toContain(
      "from './src/index.ts'"
    );

    let packageJson = JSON.parse(getFile(res, 'package.json')!.content);
    expect(packageJson.type).toBeUndefined();
    expect(packageJson.main).toBe('src/index.ts');
  });

  it('normalizes base64 encoded package files', () => {
    let encodedPackageJson = Buffer.from(
      JSON.stringify({
        name: 'custom-provider',
        type: 'module',
        main: 'index.ts'
      }),
      'utf-8'
    ).toString('base64');

    let res = getFunctionFs({
      payload: payload([
        {
          filename: 'package.json',
          content: encodedPackageJson,
          encoding: 'base64'
        },
        {
          filename: 'index.ts',
          content: 'export default {};'
        }
      ])
    });

    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error('Expected function fs to be valid');

    let packageFile = getFile(res, 'package.json')!;
    expect(packageFile.encoding).toBe('base64');

    let packageJson = JSON.parse(
      Buffer.from(packageFile.content, 'base64').toString('utf-8')
    );
    expect(packageJson.type).toBeUndefined();
    expect(packageJson.main).toBe('index.ts');
  });

  it('falls back to common entrypoints without package json', () => {
    let res = getFunctionFs({
      payload: payload([
        {
          filename: 'index.js',
          content: 'export default {};'
        }
      ])
    });

    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error('Expected function fs to be valid');

    expect(getFile(res, 'shuttle_entry_point.js')?.content).toContain("from './index.js'");
  });
});
