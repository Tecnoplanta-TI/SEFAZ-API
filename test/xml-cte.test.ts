import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extrairChaveCteDoXml } from '../src/utils/xml-cte.js';

describe('extrairChaveCteDoXml', () => {
  it('extrai chave da tag chCTe', () => {
    const xml =
      '<resCTe><chCTe>43250608466958000171570010001234567123456784</chCTe></resCTe>';

    assert.equal(
      extrairChaveCteDoXml(xml),
      '43250608466958000171570010001234567123456784',
    );
  });

  it('extrai chave do atributo Id do infCte', () => {
    const xml =
      '<cteProc><CTe><infCte Id="CTe43250608466958000171570010001234567123456784"></infCte></CTe></cteProc>';

    assert.equal(
      extrairChaveCteDoXml(xml),
      '43250608466958000171570010001234567123456784',
    );
  });
});
