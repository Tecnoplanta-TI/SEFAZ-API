import { DistribuicaoNFe, RecepcaoEvento } from '@vexta-systems/node-mde';
import {
  getDistribuicaoConfig,
  getRecepcaoConfig,
  type TipoEventoManifestacao,
} from '../config/sefaz-client.js';
import { getDefaultCnpj, normalizarCnpj } from '../config/tenants.js';
import { mapSefazResult, SefazApiError } from '../errors/sefaz-errors.js';

type DocZip = {
  xml?: string;
  schema?: string;
  nsu?: string;
};

type DistribuicaoResultado = Awaited<
  ReturnType<DistribuicaoNFe['consultaChNFe']>
>;

const EVENTO_MANIFESTACAO_OK = new Set(['135', '136', '573', '631', '655']);

const distribuicaoPorCnpj = new Map<string, DistribuicaoNFe>();
const recepcaoPorCnpj = new Map<string, RecepcaoEvento>();

function resolveCnpj(cnpj?: string): string {
  return cnpj ? normalizarCnpj(cnpj) : getDefaultCnpj();
}

function getDistribuicao(cnpj?: string): DistribuicaoNFe {
  const cnpjResolvido = resolveCnpj(cnpj);
  let distribuicao = distribuicaoPorCnpj.get(cnpjResolvido);

  if (!distribuicao) {
    distribuicao = new DistribuicaoNFe(getDistribuicaoConfig(cnpjResolvido));
    distribuicaoPorCnpj.set(cnpjResolvido, distribuicao);
  }

  return distribuicao;
}

function getRecepcao(cnpj?: string): RecepcaoEvento {
  const cnpjResolvido = resolveCnpj(cnpj);
  let recepcao = recepcaoPorCnpj.get(cnpjResolvido);

  if (!recepcao) {
    recepcao = new RecepcaoEvento(getRecepcaoConfig(cnpjResolvido));
    recepcaoPorCnpj.set(cnpjResolvido, recepcao);
  }

  return recepcao;
}

function formatSefazError(error: unknown, status = 502): string {
  if (typeof error === 'string') {
    return error;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'xml' in error &&
    String(error.xml).includes('403')
  ) {
    return 'SEFAZ retornou 403 Forbidden. Verifique se TP_AMB corresponde ao certificado (1=produção, 2=homologação) e se o certificado está válido.';
  }

  return JSON.stringify(error);
}

function extrairDocumento(resultado: DistribuicaoResultado): DocZip | undefined {
  return resultado.data?.docZip?.[0];
}

function isResumoNfe(schema?: string): boolean {
  return !!schema?.startsWith('resNFe');
}

function isProcNfe(schema?: string): boolean {
  return !!schema?.startsWith('procNFe');
}

function extrairXmlProcNfe(
  cStat: string | undefined,
  xMotivo: string | undefined,
  doc?: DocZip,
): string {
  return mapSefazResult({
    cStat,
    xMotivo,
    schema: doc?.schema,
    xml: doc?.xml,
    tipoDocumento: 'nfe',
  }).xml;
}

async function consultarDistribuicao(
  consulta: () => Promise<DistribuicaoResultado>,
): Promise<DistribuicaoResultado> {
  try {
    const resultado = await consulta();

    if (resultado.error) {
      throw new SefazApiError(
        formatSefazError(resultado.error, resultado.status),
        resultado.status || 502,
        'SEFAZ_LIBRARY_ERROR',
      );
    }

    const { cStat, xMotivo } = resultado.data ?? {};

    if (cStat && cStat !== '138') {
      mapSefazResult({ cStat, xMotivo, tipoDocumento: 'nfe' });
    }

    return resultado;
  } catch (error) {
    if (error instanceof SefazApiError) {
      throw error;
    }

    const message =
      error instanceof Error
        ? error.message
        : 'Falha de comunicação com a SEFAZ.';

    throw new SefazApiError(message, 502, 'SEFAZ_COMMUNICATION_ERROR');
  }
}

export async function manifestarNfe(
  chave: string,
  tipoEvento: TipoEventoManifestacao = 210210,
  justificativa?: string,
  cnpj?: string,
): Promise<void> {
  if (tipoEvento === 210240 && !justificativa) {
    throw new SefazApiError(
      'Justificativa é obrigatória para Operação não Realizada (210240).',
      400,
      'JUSTIFICATIVA_OBRIGATORIA',
    );
  }

  let resultado;

  try {
    resultado = await getRecepcao(cnpj).enviarEvento({
      lote: [
        {
          chNFe: chave,
          tipoEvento,
          ...(justificativa ? { justificativa } : {}),
        },
      ],
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Falha ao manifestar NF-e na SEFAZ.';

    throw new SefazApiError(message, 502, 'SEFAZ_MANIFESTACAO_ERROR');
  }

  if (resultado.error) {
    throw new SefazApiError(
      formatSefazError(resultado.error, resultado.status),
      resultado.status || 502,
      'SEFAZ_MANIFESTACAO_ERROR',
    );
  }

  const evento = resultado.data?.infEvento?.[0];

  if (!evento) {
    throw new SefazApiError(
      'A SEFAZ não retornou o resultado da manifestação.',
      502,
      'SEFAZ_MANIFESTACAO_EMPTY',
    );
  }

  if (!EVENTO_MANIFESTACAO_OK.has(evento.cStat)) {
    throw new SefazApiError(
      evento.xMotivo ?? 'Manifestação rejeitada pela SEFAZ.',
      502,
      'SEFAZ_MANIFESTACAO_REJECTED',
      {
        cStat: evento.cStat,
        tpEvento: evento.tpEvento,
      },
    );
  }
}

async function obterXmlDistribuicao(
  chave: string,
  nsu: string | undefined,
  cnpj?: string,
): Promise<string> {
  const porChave = await consultarDistribuicao(() =>
    getDistribuicao(cnpj).consultaChNFe(chave),
  );

  const { cStat, xMotivo } = porChave.data ?? {};
  const docChave = extrairDocumento(porChave);

  if (isProcNfe(docChave?.schema)) {
    return extrairXmlProcNfe(cStat, xMotivo, docChave);
  }

  if (nsu) {
    const porNsu = await consultarDistribuicao(() =>
      getDistribuicao(cnpj).consultaNSU(nsu),
    );
    const { cStat: cStatNsu, xMotivo: xMotivoNsu } = porNsu.data ?? {};
    const docNsu = extrairDocumento(porNsu);

    if (isProcNfe(docNsu?.schema)) {
      return extrairXmlProcNfe(cStatNsu, xMotivoNsu, docNsu);
    }
  }

  if (isResumoNfe(docChave?.schema)) {
    throw new SefazApiError(
      'A SEFAZ retornou apenas o resumo da NF-e. Manifeste a nota para liberar o XML completo.',
      422,
      'RESUMO_NFE',
      { schema: docChave?.schema },
    );
  }

  return extrairXmlProcNfe(cStat, xMotivo, docChave);
}

export async function consultarNfePorChave(
  chave: string,
  cnpj?: string,
): Promise<string> {
  const primeiraConsulta = await consultarDistribuicao(() =>
    getDistribuicao(cnpj).consultaChNFe(chave),
  );

  const { cStat, xMotivo } = primeiraConsulta.data ?? {};
  const primeiroDoc = extrairDocumento(primeiraConsulta);

  if (isProcNfe(primeiroDoc?.schema)) {
    return extrairXmlProcNfe(cStat, xMotivo, primeiroDoc);
  }

  if (!isResumoNfe(primeiroDoc?.schema)) {
    return extrairXmlProcNfe(cStat, xMotivo, primeiroDoc);
  }

  await manifestarNfe(chave, 210210, undefined, cnpj);

  return obterXmlDistribuicao(chave, primeiroDoc?.nsu, cnpj);
}
