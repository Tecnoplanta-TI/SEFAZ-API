import 'dotenv/config';
import { DistribuicaoNFe } from '@vexta-systems/node-mde';
import { loadCertBuffer } from '../src/config/cert.js';
import { getEnv } from '../src/config/env.js';

const chave = process.argv[2] ?? '29260113873377000105550010000406211435401137';
const env = getEnv();

const distribuicao = new DistribuicaoNFe({
  pfx: loadCertBuffer(),
  passphrase: env.CERT_PASSPHRASE,
  cnpj: env.CNPJ,
  cUFAutor: env.CUF_AUTOR as '29',
  tpAmb: env.TP_AMB,
});

const resultado = await distribuicao.consultaChNFe(chave.replace(/\D/g, ''));

console.log(
  JSON.stringify(
    {
      error: resultado.error,
      status: resultado.status,
      data: resultado.data,
    },
    null,
    2,
  ),
);
