import { describe, expect, it } from 'vitest';
import { transformEditionSource } from '../src/tooling/transform';

let transform = (code: string, edition: 'cloud' | 'on-prem') =>
  transformEditionSource(code, { edition, fileName: 'file.ts' });

describe('transformEditionSource', () => {
  it('ignores files that do not use the package', () => {
    expect(transform(`let a = checkEdition('cloud');`, 'cloud')).toBeNull();
  });

  it('folds checkEdition to booleans', () => {
    let code = `
      import { checkEdition } from '@metorial/editions';
      let a = checkEdition('cloud');
      let b = checkEdition('on-prem');
      let c = checkEdition('cloud', 'on-prem');
    `;

    let result = transform(code, 'on-prem')!;

    expect(result).toContain('let a = false;');
    expect(result).toContain('let b = true;');
    expect(result).toContain('let c = true;');
  });

  it('supports aliased imports', () => {
    let code = `
      import { checkEdition as isEdition } from '@metorial/editions';
      if (isEdition('cloud')) run();
    `;

    expect(transform(code, 'cloud')!).toContain('if (true) run();');
  });

  it('selects the perEdition branch and keeps only that expression', () => {
    let code = `
      import { perEdition } from '@metorial/editions';
      let value = perEdition({ cloud: cloudThing(), 'on-prem': ['x'] });
    `;

    let result = transform(code, 'on-prem')!;

    expect(result).toContain(`let value = (['x']);`);
    expect(result).not.toContain('cloudThing');
  });

  it('resolves nested perEdition calls', () => {
    let code = `
      import { perEdition } from '@metorial/editions';
      let value = perEdition({ cloud: 1, 'on-prem': perEdition({ cloud: 2, 'on-prem': 3 }) });
    `;

    expect(transform(code, 'on-prem')!).toContain('let value = ((3));');
  });

  it('folds getEdition to a string literal', () => {
    let code = `
      import { getEdition } from '@metorial/editions';
      let edition = getEdition();
    `;

    expect(transform(code, 'cloud')!).toContain(`let edition = "cloud";`);
  });

  it('folds isBuilt to true so guarded code is removed from bundles', () => {
    let code = `
      import { isBuilt } from '@metorial/editions';
      if (!isBuilt()) { await import('./devOnly'); }
    `;

    expect(transform(code, 'on-prem')!).toContain('if (!true)');
  });

  it('replaces satisfied assertEdition and keeps failing ones', () => {
    let code = `
      import { assertEdition } from '@metorial/editions';
      assertEdition('cloud');
    `;

    expect(transform(code, 'cloud')!).toContain('void 0;');
    expect(transform(code, 'on-prem')).toBeNull();
  });

  it('rejects non-literal arguments', () => {
    let code = `
      import { checkEdition } from '@metorial/editions';
      let name = 'cloud';
      checkEdition(name);
    `;

    expect(() => transform(code, 'cloud')).toThrow('string literal');
  });

  it('rejects unknown editions and missing perEdition values', () => {
    expect(() =>
      transform(
        `import { checkEdition } from '@metorial/editions'; checkEdition('nope');`,
        'cloud'
      )
    ).toThrow('Unknown edition');

    expect(() =>
      transform(
        `import { perEdition } from '@metorial/editions'; perEdition({ cloud: 1 });`,
        'on-prem'
      )
    ).toThrow('no value');
  });
});

describe('release channel transform', () => {
  let code = `
    import { checkReleaseChannel as check, getReleaseChannel } from '@metorial/editions';
    let allowed = check('dev');
    let channel = getReleaseChannel();
  `;

  it.each(['dev', 'release'] as const)('folds the %s channel', channel => {
    let result = transformEditionSource(code, {
      edition: 'on-prem',
      channel,
      fileName: 'file.ts'
    });

    expect(result).toContain(`let allowed = ${channel == 'dev'};`);
    expect(result).toContain(`let channel = "${channel}";`);
  });

  it.each([
    'checkReleaseChannel(name)',
    "checkReleaseChannel('invalid')",
    'checkReleaseChannel()'
  ])('rejects an unbuildable guard: %s', expression => {
    expect(() =>
      transform(
        `import { checkReleaseChannel } from '@metorial/editions'; ${expression}`,
        'on-prem'
      )
    ).toThrow();
  });
});

describe('Vite release channels', () => {
  it('uses the same literal transform and compiled channel definition', async () => {
    let { editionsVitePlugin } = await import('../src/tooling/vite');
    let plugin = editionsVitePlugin('on-prem', 'release');
    let transformed = plugin.transform(
      `import { checkReleaseChannel } from '@metorial/editions'; if (checkReleaseChannel('dev')) devOnly();`,
      '/app.ts?query'
    );

    expect(transformed?.code).toContain('if (false)');
    expect(plugin.config().define.__METORIAL_RELEASE_CHANNEL__).toBe('"release"');
  });
});
