import { describe, expect, test } from 'vitest';
import { JWT } from './jwt';

describe('jwt', () => {
  test('hs256', async () => {
    let token = await JWT.sign(
      { test: 'test' },
      { issuer: 'test', audience: 'test', alg: 'HS256' },
      'test'
    );
    expect(typeof token).toBe('string');

    let payload = await JWT.verify<{ test: string }>(
      token,
      { issuer: 'test', audience: 'test', alg: 'HS256' },
      'test'
    );
    expect(payload.test).toBe('test');
  });

  test('rsa256', async () => {
    let privateKey = {
      alg: 'RS256',
      d: 'BD5mCPcc-SX6LfzaQu6JnJDmJrQC6DOtI71pyXTmQL7HCvJp252KfVVyK5yPznvOSOip1jcA-xG7l49abph1bIzPvUQzwIFkrWBiv-g0PABJdL-WgGXbCPKK6q5IFnueEJo9b0lfZBJ0kCs1M9jmXVZ3rAzEmCH8bJHqocp45k672iB-MxvOxZwJccAX4-moBFjJ3d1SjIafzt40gZ2NtBSV4lSWxD5hN9T8YzODx2S5yEGksZHpW1nmyDjeJqQuNqtZLYTsPidPE-VbeupZJJSIkV3K19orv5o9PaC8sf7bAlmCSfb-oqrY5D133l13kYj5m4SzLej31Ei_Es-z8s7N7PVVUXMT0QxZVHskkmc88wUJ_ADEUqaDnhkWcSD9Ek0YexDvqVeFHVEjjXJG95KuXF3hNuWnBcqQzamz86avNrMQVgzSKnmUb5yH6tJE1K-SVEFnSIoscJaLDPffMlOjlxFcvNbTGfFBkfccrBVGC5C36H2xo8mIX0T4Lf65D8peZRw57eSTloLesKt_A-NOe-0FsMoINDbky5vVnQ0ijFr7KzDlAdB8dt8szfFUfwuHVFiJ1xA9k_Ne0fy_SATAEQgrTdWURqlAgOfpbq6F3GkaPcDlS-plO04PyqIJD-P87lbZQngrWAB-jDf2C7WQwodjRA66HGShKSB9TFE',
      dp: 'yZF-qQJfJ-r1Et8ZZziDJVWX6eEzS_g6UpTvG9OjRTxrlvjIvTMtt0P3_LhL132gs0HefGl8f5OohN6zYKzaoU-DUFXke2e1zi8PYc54k1-ul-qAGSI85FdTW_dHuBZ65ShRfOVAf6JGcU8Bvej2PoulMjwUMow2oxGyCHXrYYy0Lh3vmRxoJDZKT8fK2A5fE3kNJEZ1rXYk7Hcf_CzkC3hoLhCsoMbL78HOl-4ScQREB1hoXcGrG80u8JcyUis6K04ZU3fnB0cfPOo0b7j26NvVCaDvNgh3TcrFvzuHRb5fsYIplHObE2eVO_yrmrIpdxX9ilZEy1Wf0l1xSSv2lw',
      dq: 'wl539sWbwygHVmf_ouJMt2sh7TuNLh70IVRFOZa_9FqrWMBDvObCuPOvtqbpSlvgUqmbl4x3ydFyCCv_Pi311qjcFqvTDZsaHeRiSY39Xgg-F_K6NljpLm0pPsiqwQCmKS7ZCLNOCij7B7k00v0vc_yl8kClhSh2sBaPyKaK4p5YpUEP-bMS1ExI6QpQZWXetQenUIRe2oCPF190i_7RU4F7Uhx-00F3ZTcEq7u0RRHg6u3k4q3z2L-9sjm9DZbcHVxBZ-tyDTeIIOQkwgsFoFDhgOliqplDKSnpopH-ZoWbBXThM9EV2QXYq4FkKiu6IPrLGGEawab1mT93GvUsqQ',
      e: 'AQAB',
      ext: true,
      key_ops: ['sign'],
      kty: 'RSA',
      n: 'oLonMw_o114cSA2He8xcELRM3w_6tKKy3XaUfFBwFoV426TeNtPPbTs42RxRpDfbxWCgy7GH0nrj55TUQrS6yzCRaNplTCcdDS0ckRDTxBJS4flhKqkLTaMSaFQ0TqlyIDzHxVtKxt8Su6z_-oL9fZQXkeCc89YREOp1uBXwQYOTATwNydqkP53c4GPlm6C26rJzUHqtEguHni6oReWf5sYtwtJb90sEHVKkxtILytC2xAcfmj7sij8LFZtlHsMOROBgd_eAofXiph1_CMq_z9dWcWCbpGzx8QbAqS8X9O02RCFaG6XnJ6GbQ5MDDXQJUhmOVay5BMGHlRfQAEraYs5A_asa-y_3DoJxOf9QFfdU61kx9AFc92vOAVzPI8RvyLGktAwd2Cb_SrW7vSvmDEpUin5XJNT4Xy5w0VZhph5GhwxwBoviGckxy12LgyTUbb3EyxM4RkoAYB6B4yws7SQHTGgbpkjJK7CmqhJziRQqNnyQGcBjFfPLq_gu3RC2H2yAQatUn3WnxM1qXFg-XlQ4knQZM2V9xjqZeWp9pS6LhtYR0KgWESrKXD9IA3_MYKMq1G3uvDsVfcv5HGxYvnHjpAoS7Ropzu9qwnpAKLeBLMtUHje66RJ1niddEjBcfgzmXOAVntiFZt70JBjO26PlPHaMQgResYWm4w_4ZCU',
      p: 'ywShrXBsP8Jsqg5kh7V6bCwRo6amLlIF65wPYNBbLzbR1CppE6rLe6Q72d653NdVAPNNlM5teschWl8TsErTzovt4s3ygrCZXaq8BdyLtLLkThOFoGXv-1vAEqy0vRMc2UOM3zHlamPaOq5_X0V_7-SBlkZo3_DtsOIBYq75B8E7OdyrQ3gVT35yMGBaZL7_jgg5nm-flAba4-nP-bFeyEPHSwa38wO8h3jf2heDQ4rrdybLe1wR0fpWaWhsZx2nbveyfCm6np1_1DmWZ0vV-ShCVnm44z431h2rqiiut_9MJ854vN23_aZfIx75F8Qe7asDl-HgLY2EUFvbN4OErw',
      q: 'yqwe6VPd0m4D77R-aC40AwedLDkhY73c162nMtTpzmrHM_AmTsypX3t7SvzSoZuFNzjm1Uxb6fIBHU09OASDVZPtr4QWlj1Sp5Nt4f2mR1msSo6AMRW_i5GikFMQacAhiXIJ1rNXAaySgLGBltupddvGIB9gwCzRv6JqtgKWrOX2RZt_h9dBWHrEV9xkGS5FOKQ1_kFk_bNNeCY80RNkpYpl11V05VSufArsaWE3QAmJ_6MAzPfMizcs7PwSFOcQQrOyyrH8BwMZ24XUyRxMW-otAahDug6fDgQE8EKbTLyKRLhj39DbZmETeYhALGEvN8F8qjSzrpxnCHGXSIjBaw',
      qi: 'KahHXGJ8rsuxYyF1pTk4OyG7YeOGmJ_aNcC3YYpp1oB1OOkyMlKYOtx1blm7sTKNEMERTG9IUCIdH_7r3KKvgiwxJckUcauGEetwxQAuuNulmhOhT6fQIC68UKCcIr98uh3uCDXMauCxk_gAeKE1SYQsF28a_z1jhW_F4x2zAL4WP0c7UGpOaG86tOp9MCxHOSsdbkzwW2iV43Jde20-nfJMqCG-wyieHLLbLslzXNm-jGW8GiUc2SYd7Z-7aat3cpgLQgIcRAZcEThzcWlTVHMkXX3Nl8x7irbVNj5ZMOu0PKbtGt8k9OYzzUDCLmGaWlU46QiRune0WqLwpxSlEw'
    };

    let publicKey = {
      alg: 'RS256',
      e: 'AQAB',
      ext: true,
      key_ops: ['verify'],
      kty: 'RSA',
      n: 'oLonMw_o114cSA2He8xcELRM3w_6tKKy3XaUfFBwFoV426TeNtPPbTs42RxRpDfbxWCgy7GH0nrj55TUQrS6yzCRaNplTCcdDS0ckRDTxBJS4flhKqkLTaMSaFQ0TqlyIDzHxVtKxt8Su6z_-oL9fZQXkeCc89YREOp1uBXwQYOTATwNydqkP53c4GPlm6C26rJzUHqtEguHni6oReWf5sYtwtJb90sEHVKkxtILytC2xAcfmj7sij8LFZtlHsMOROBgd_eAofXiph1_CMq_z9dWcWCbpGzx8QbAqS8X9O02RCFaG6XnJ6GbQ5MDDXQJUhmOVay5BMGHlRfQAEraYs5A_asa-y_3DoJxOf9QFfdU61kx9AFc92vOAVzPI8RvyLGktAwd2Cb_SrW7vSvmDEpUin5XJNT4Xy5w0VZhph5GhwxwBoviGckxy12LgyTUbb3EyxM4RkoAYB6B4yws7SQHTGgbpkjJK7CmqhJziRQqNnyQGcBjFfPLq_gu3RC2H2yAQatUn3WnxM1qXFg-XlQ4knQZM2V9xjqZeWp9pS6LhtYR0KgWESrKXD9IA3_MYKMq1G3uvDsVfcv5HGxYvnHjpAoS7Ropzu9qwnpAKLeBLMtUHje66RJ1niddEjBcfgzmXOAVntiFZt70JBjO26PlPHaMQgResYWm4w_4ZCU'
    };

    let token = await JWT.sign(
      { test: 'test' },
      { issuer: 'test', audience: 'test', alg: 'RS256' },
      privateKey
    );
    expect(typeof token).toBe('string');

    let payload = await JWT.verify<{ test: string }>(
      token,
      { issuer: 'test', audience: 'test', alg: 'RS256' },
      publicKey
    );
    expect(payload.test).toBe('test');
  });
});
