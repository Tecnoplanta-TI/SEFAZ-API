import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';

describe('POST /nfe/consulta', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  before(async () => {
    app = await buildApp({
      consultarNfe: async () =>
        '<nfeProc><ide><dhEmi>2022-12-31T10:00:00-03:00</dhEmi></ide></nfeProc>',
    });
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

  it('retorna xml quando consulta é bem-sucedida', async () => {
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
      xml: string;
      xmlPostingDate: string | null;
    }>();

    assert.equal(body.status, 'ok');
    assert.equal(body.chave, chave);
    assert.match(body.xml, /dhEmi/);
    assert.equal(body.xmlPostingDate, '31/12/2022');
  });
});
