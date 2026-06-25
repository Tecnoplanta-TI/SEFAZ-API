import 'dotenv/config';
import { consultarNfePorChave } from '../src/services/sefaz.service.js';
import { normalizarChaveNfe } from '../src/utils/chave.js';

const chave = normalizarChaveNfe(
  process.argv.slice(2).join('') || process.env.NFE_CHAVE_TESTE || '',
);

if (!chave) {
  console.error(
    'Uso: npx tsx scripts/test-homolog.ts <chave_44_digitos>\n' +
      'A chave pode ter espaços: npm run test:homolog -- "4326 0608 ... 6769"\n' +
      'Ou defina NFE_CHAVE_TESTE no .env',
  );
  process.exit(1);
}

try {
  const xml = await consultarNfePorChave(chave);
  console.log(
    JSON.stringify(
      {
        status: 'ok',
        chave,
        xmlLength: xml.length,
        xmlPreview: xml.slice(0, 120),
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(
    JSON.stringify(
      {
        status: 'error',
        message: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exit(1);
}
