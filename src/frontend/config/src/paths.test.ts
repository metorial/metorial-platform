import { describe, expect, it } from 'vitest';
import { Paths } from './paths';

let organization = { slug: 'eigenspace' };
let project = { slug: 'my-project' };
let instance = { slug: 'development' };

describe('Paths.instance auth credential routes', () => {
  it('builds the auth credentials list route with the plural segment', () => {
    expect(Paths.instance.providerAuthCredentials(organization, project, instance)).toBe(
      '/i/eigenspace/my-project/development/configurations/auth-credentials'
    );
  });

  it('keeps the auth credential detail route singular', () => {
    expect(
      Paths.instance.providerAuthCredential(
        organization,
        project,
        instance,
        'par_0mnlu1nlj8liTV7HOOZGIO'
      )
    ).toBe(
      '/i/eigenspace/my-project/development/configurations/auth-credential/par_0mnlu1nlj8liTV7HOOZGIO'
    );
  });
});
