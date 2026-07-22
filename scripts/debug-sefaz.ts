import 'dotenv/config';
import { DistribuicaoNFe } from '@vexta-systems/node-mde';
import { getDistribuicaoConfig } from '../src/config/sefaz-client.js';

const chave = process.argv[2] ?? '29260113873377000105550010000406211435401137';
const cnpj = process.argv[3];

const distribuicao = new DistribuicaoNFe(getDistribuicaoConfig(cnpj));

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
