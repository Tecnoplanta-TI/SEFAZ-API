import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetTenantsCache } from '../src/config/tenants.js';
import { buildApp } from '../src/app.js';

const TENANT_A = '13873377000105';

describe('POST /cte/consulta', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  before(async () => {
    process.env.TP_AMB = '1';
    process.env.SEFAZ_TENANTS = JSON.stringify({
      [TENANT_A]: {
        certBase64: Buffer.from('cert-a').toString('base64'),
        passphrase: 'senha-a',
        cUFAutor: '43',
      },
    });
    process.env.DEFAULT_CNPJ = TENANT_A;
    resetTenantsCache();

    app = await buildApp({
      consultarCte: async () =>
        '<cteProc><ide><dhEmi>2023-06-15T08:30:00-03:00</dhEmi></ide></cteProc>',
    });
  });

  after(async () => {
    await app.close();
  });

  it('retorna 400 quando chave é de NF-e', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/cte/consulta',
      payload: { chave: '29260113873377000105550010000406211435401137' },
    });

    assert.equal(response.statusCode, 400);
    assert.match(response.body, /POST \/nfe\/consulta/);
  });

  it('retorna xml quando consulta é bem-sucedida', async () => {
    const chave = '43250608466958000171570010001234567123456784';

    const response = await app.inject({
      method: 'POST',
      url: '/cte/consulta',
      payload: { chave, cnpj: TENANT_A },
    });

    assert.equal(response.statusCode, 200);

    const body = response.json<{
      status: string;
      chave: string;
      cnpj: string;
      xml: string;
      xmlPostingDate: string | null;
    }>();

    assert.equal(body.status, 'ok');
    assert.equal(body.chave, chave);
    assert.equal(body.cnpj, TENANT_A);
    assert.match(body.xml, /cteProc/);
    assert.equal(body.xmlPostingDate, '15/06/2023');
  });
});
