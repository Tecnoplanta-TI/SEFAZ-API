import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extrairXmlPostingDate } from '../src/utils/xml-nfe.js';

describe('extrairXmlPostingDate', () => {
  it('extrai dhEmi no formato DD/MM/AAAA', () => {
    const xml =
      '<nfeProc><ide><dhEmi>2022-12-31T10:00:00-03:00</dhEmi></ide></nfeProc>';

    assert.equal(extrairXmlPostingDate(xml), '31/12/2022');
  });

  it('extrai dEmi no formato DD/MM/AAAA', () => {
    const xml = '<NFe><ide><dEmi>2022-12-31</dEmi></ide></NFe>';

    assert.equal(extrairXmlPostingDate(xml), '31/12/2022');
  });

  it('normaliza data já informada com hífen', () => {
    const xml = '<ide><dhEmi>31-12-2022</dhEmi></ide>';

    assert.equal(extrairXmlPostingDate(xml), '31/12/2022');
  });

  it('retorna undefined quando a data não existe no xml', () => {
    assert.equal(extrairXmlPostingDate('<nfeProc>xml</nfeProc>'), undefined);
  });
});
