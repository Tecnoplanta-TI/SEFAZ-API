import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  getDefaultCnpj,
  getTenant,
  resetTenantsCache,
} from '../src/config/tenants.js';

describe('tenants config', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    resetTenantsCache();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetTenantsCache();
  });

  it('carrega múltiplos tenants de SEFAZ_TENANTS', () => {
    process.env.TP_AMB = '1';
    process.env.SEFAZ_TENANTS = JSON.stringify({
      '13873377000105': {
        certBase64: 'YQ==',
        passphrase: 'x',
        cUFAutor: '43',
      },
      '12345678000199': {
        certBase64: 'Yg==',
        passphrase: 'y',
        cUFAutor: '35',
      },
    });
    process.env.DEFAULT_CNPJ = '12345678000199';

    assert.equal(getDefaultCnpj(), '12345678000199');
    assert.equal(getTenant('13873377000105').cUFAutor, '43');
    assert.equal(getTenant('12.345.678/0001-99').cnpj, '12345678000199');
  });

  it('mantém compatibilidade com variáveis legadas', () => {
    delete process.env.SEFAZ_TENANTS;
    delete process.env.DEFAULT_CNPJ;
    process.env.TP_AMB = '1';
    process.env.CNPJ = '13873377000105';
    process.env.CERT_PASSPHRASE = 'senha';
    process.env.CUF_AUTOR = '43';
    process.env.CERT_BASE64 = 'YQ==';

    assert.equal(getDefaultCnpj(), '13873377000105');
    assert.equal(getTenant().passphrase, 'senha');
  });
});
