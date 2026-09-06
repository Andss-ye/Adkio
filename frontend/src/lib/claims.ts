/**
 * Helpers de presentación para `claims_validator` (ADK-10).
 *
 * La tool es determinista y vive en el backend (`backend/tools/claims_validator.py`).
 * Acá NO se replican sus reglas: solo se traduce su salida a algo mostrable y se
 * arma el pedido de reescritura que va a `POST /campaign/refine`.
 */
import type { Claim, ClaimCategoria, ClaimsResult } from "@/hooks/useCampaignStream";

/**
 * Espejo de `_ETIQUETAS` en `backend/tools/claims_validator.py`. Los strings
 * humanizados de `blockers`/`warnings` ya las traen embebidas, pero el detalle
 * estructurado vive en `claims[]` y solo expone la `categoria` cruda.
 */
export const CLAIM_ETIQUETAS: Record<ClaimCategoria, string> = {
  promesa_de_resultado: "promesa de resultado",
  salud: "claim de salud",
  antes_despues: "antes y después",
  atributo_personal: "atributo personal",
  superlativo: "superlativo",
};

export function etiquetaDe(categoria: string): string {
  return CLAIM_ETIQUETAS[categoria as ClaimCategoria] ?? categoria.replace(/_/g, " ");
}

/** Separa el detalle estructurado por severidad, blockers primero. */
export function splitClaims(result?: ClaimsResult | null): {
  blockers: Claim[];
  warnings: Claim[];
} {
  const claims = result?.claims ?? [];
  return {
    blockers: claims.filter((c) => c.severidad === "blocker"),
    warnings: claims.filter((c) => c.severidad === "warning"),
  };
}

// `RefineRequest` (backend/main.py) valida el feedback entre 2 y 500 caracteres.
const FEEDBACK_MAX = 500;

/**
 * Arma el pedido de reescritura con los textos ofensores literales. Corta la
 * lista de claims si no entra en el tope del endpoint, en vez de que el backend
 * rechace el refine con un 422.
 */
export function buildClaimsFeedback(blockers: Claim[]): string {
  const prefijo = "Reescribí el copy sin estos claims que Meta rechaza: ";
  const sufijo = ". Mantené el mismo objetivo, tono y CTA.";
  const partes = blockers.map(
    (c) => `«${c.texto}» en ${c.campo} (${etiquetaDe(c.categoria)})`,
  );

  const incluidas: string[] = [];
  for (const parte of partes) {
    const tentativa = [...incluidas, parte].join("; ");
    if ((prefijo + tentativa + sufijo).length > FEEDBACK_MAX) break;
    incluidas.push(parte);
  }

  // Ni un solo claim entra (texto ofensor larguísimo): pedido genérico pero útil.
  if (incluidas.length === 0) {
    return "Reescribí el copy sin promesas de resultado, claims de salud, antes/después ni atributos personales. Mantené el mismo objetivo, tono y CTA.";
  }
  return prefijo + incluidas.join("; ") + sufijo;
}
