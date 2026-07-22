import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { resetTenantsCache } from '../src/config/tenants.js';
import { buildApp } from '../src/app.js';

const TENANT_A = '13873377000105';
const TENANT_B = '12345678000199';

function setupTenantsEnv(): void {
  process.env.TP_AMB = '1';
  process.env.SEFAZ_TENANTS = JSON.stringify({
    [TENANT_A]: {
      certBase64: Buffer.from('cert-a').toString('base64'),
      passphrase: 'senha-a',
      cUFAutor: '43',
    },
    [TENANT_B]: {
      certBase64: Buffer.from('cert-b').toString('base64'),
      passphrase: 'senha-b',
      cUFAutor: '43',
    },
  });
  process.env.DEFAULT_CNPJ = TENANT_A;
  resetTenantsCache();
}

describe('POST /nfe/consulta', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let ultimoCnpj: string | undefined;

  before(async () => {
    setupTenantsEnv();

    app = await buildApp({
      consultarNfe: async (_chave, cnpj) => {
        ultimoCnpj = cnpj;
        return '<nfeProc><ide><dhEmi>2022-12-31T10:00:00-03:00</dhEmi></ide></nfeProc>';
      },
    });
  });

  beforeEach(() => {
    ultimoCnpj = undefined;
  });

  after(async () => {
    await app.close();
  });

  it('retorna 400 quando chave é inválida', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/nfe/consulta',
      payload: { chave: '123' },
    });

    assert.equal(response.statusCode, 400);
    assert.match(response.body, /tamanho incorreto/);
  });

  it('retorna xml quando consulta é bem-sucedida com CNPJ padrão', async () => {
    const chave = '29260113873377000105550010000406211435401137';

    const response = await app.inject({
      method: 'POST',
      url: '/nfe/consulta',
      payload: { chave },
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
    assert.equal(ultimoCnpj, TENANT_A);
    assert.match(body.xml, /dhEmi/);
    assert.equal(body.xmlPostingDate, '31/12/2022');
  });

  it('usa o CNPJ informado no body', async () => {
    const chave = '29260113873377000105550010000406211435401137';

    const response = await app.inject({
      method: 'POST',
      url: '/nfe/consulta',
      payload: { chave, cnpj: TENANT_B },
    });

    assert.equal(response.statusCode, 200);

    const body = response.json<{ cnpj: string }>();
    assert.equal(body.cnpj, TENANT_B);
    assert.equal(ultimoCnpj, TENANT_B);
  });

  it('aceita CNPJ de filial com mesma base do certificado', async () => {
    const chave = '29260113873377000105550010000406211435401137';
    const filial = '13873377000288';

    const response = await app.inject({
      method: 'POST',
      url: '/nfe/consulta',
      payload: { chave, cnpj: filial },
    });

    assert.equal(response.statusCode, 200);

    const body = response.json<{ cnpj: string }>();
    assert.equal(body.cnpj, filial);
    assert.equal(ultimoCnpj, filial);
  });

  it('retorna 400 para CNPJ não configurado', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/nfe/consulta',
      payload: {
        chave: '29260113873377000105550010000406211435401137',
        cnpj: '99999999000191',
      },
    });

    assert.equal(response.statusCode, 400);
    assert.match(response.body, /não configurado/);
  });
});
