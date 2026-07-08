const CH_CTE_REGEX = /<chCTe>(\d{44})<\/chCTe>/i;
const INF_CTE_ID_REGEX = /infCte[^>]*\sId="CTe(\d{44})"/i;

export function extrairChaveCteDoXml(xml: string): string | undefined {
  const chCTe = xml.match(CH_CTE_REGEX)?.[1];
  if (chCTe) {
    return chCTe;
  }

  return xml.match(INF_CTE_ID_REGEX)?.[1];
}
