import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validarChaveNfe } from '../src/utils/chave.js';
import { mapSefazResult, SefazApiError } from '../src/errors/sefaz-errors.js';

describe('validarChaveNfe', () => {
  it('aceita chave com espaços como na DANFE', () => {
    assert.equal(
      validarChaveNfe('4326 0608 8669 5800 0171 5500 1000 1200 9816 8426 6769'),
      true,
    );
  });

  it('rejeita chave com tamanho incorreto', () => {
    assert.equal(validarChaveNfe('123'), false);
  });

  it('rejeita chave com dígito verificador inválido', () => {
    assert.equal(
      validarChaveNfe('29260113873377000105550010000406211435401138'),
      false,
    );
  });
});

describe('mapSefazResult', () => {
  it('retorna xml para procNFe com cStat 138', () => {
    const result = mapSefazResult({
      cStat: '138',
      schema: 'procNFe_v4.00.xsd',
      xml: '<nfeProc>ok</nfeProc>',
    });

    assert.equal(result.xml, '<nfeProc>ok</nfeProc>');
  });

  it('lança 404 para cStat 137', () => {
    assert.throws(
      () =>
        mapSefazResult({
          cStat: '137',
          xMotivo: 'Nenhum documento localizado',
        }),
      (error: unknown) =>
        error instanceof SefazApiError && error.statusCode === 404,
    );
  });

  it('lança 422 para resNFe', () => {
    assert.throws(
      () =>
        mapSefazResult({
          cStat: '138',
          schema: 'resNFe_v1.01.xsd',
          xml: '<resNFe/>',
        }),
      (error: unknown) =>
        error instanceof SefazApiError && error.statusCode === 422,
    );
  });

  it('lança 503 para cStat 656', () => {
    assert.throws(
      () =>
        mapSefazResult({
          cStat: '656',
          xMotivo: 'Consumo indevido',
        }),
      (error: unknown) =>
        error instanceof SefazApiError && error.statusCode === 503,
    );
  });
});
