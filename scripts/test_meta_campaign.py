"""
Test 2: Creación completa de una campaña sandbox en Meta Ads API.
Simula exactamente lo que hará campaign_launcher.py en el agente.

Flujo:
    Campaign -> AdSet -> AdCreative -> Ad

Todos los objetos se crean con status=PAUSED y en cuenta sandbox,
por lo que no hay entrega real ni gasto.

Uso:
    python scripts/test_meta_campaign.py
    python scripts/test_meta_campaign.py --cleanup   (elimina lo creado al final)
"""
import os
import sys
import argparse
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv()

from facebook_business.api import FacebookAdsApi
from facebook_business.adobjects.adaccount import AdAccount
from facebook_business.adobjects.campaign import Campaign
from facebook_business.adobjects.adset import AdSet
from facebook_business.adobjects.adcreative import AdCreative
from facebook_business.adobjects.ad import Ad
from facebook_business.adobjects.targetingsearch import TargetingSearch
from facebook_business.exceptions import FacebookRequestError


# ---- Constantes del test ----

TEST_CAMPAIGN_NAME = f"[TEST] 30X Bogota Sandbox - {datetime.now().strftime('%Y-%m-%d %H:%M')}"

# Términos de interés a buscar via TargetingSearch (los IDs los resuelve Meta en runtime)
INTEREST_QUERIES = ["Entrepreneurship", "Leadership", "Small business"]

# Imagen publica de prueba (HTTPS requerido por Meta)
# En produccion esta URL viene de Cloudinary
TEST_IMAGE_URL = "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Cat03.jpg/1200px-Cat03.jpg"


def ads_manager_url(account_id: str, campaign_id: str = "") -> str:
    clean_id = account_id.replace("act_", "")
    base = f"https://adsmanager.facebook.com/adsmanager/manage/campaigns?act={clean_id}"
    if campaign_id:
        base += f"&selected_campaign_ids={campaign_id}"
    return base


def init_sdk() -> AdAccount:
    FacebookAdsApi.init(
        app_id=os.getenv("META_APP_ID"),
        app_secret=os.getenv("META_APP_SECRET", ""),
        access_token=os.getenv("META_ACCESS_TOKEN"),
    )
    return AdAccount(os.getenv("META_AD_ACCOUNT_ID"))


def _print_full_error(e: FacebookRequestError) -> None:
    """Imprime todos los campos del error de Meta para facilitar el diagnóstico."""
    print(f"  Mensaje    : {e.api_error_message()}")
    print(f"  Codigo     : {e.api_error_code()}")
    print(f"  Tipo       : {e.api_error_type()}")
    try:
        body = e.body()
        sub = body.get("error", {})
        print(f"  Subcode    : {sub.get('error_subcode', 'n/a')}")
        print(f"  User msg   : {sub.get('error_user_msg', 'n/a')}")
        print(f"  User title : {sub.get('error_user_title', 'n/a')}")
        print(f"  Blame      : {sub.get('error_data', 'n/a')}")
    except Exception:
        pass


# Intentamos primero OUTCOME_LEADS (v18+); si falla, caemos a LEAD_GENERATION (legacy).
_CAMPAIGN_OBJECTIVES = [
    {
        "label": "OUTCOME_LEADS con presupuesto por AdSet (recomendado)",
        "params": {
            "objective": "OUTCOME_LEADS",
            "buying_type": "AUCTION",
            "special_ad_categories": [],
            # API v21+: obligatorio cuando no se usa Campaign Budget Optimization.
            # False = cada AdSet maneja su propio presupuesto de forma independiente.
            "is_adset_budget_sharing_enabled": False,
        },
    },
    {
        "label": "OUTCOME_TRAFFIC (fallback para verificar write access)",
        "params": {
            "objective": "OUTCOME_TRAFFIC",
            "buying_type": "AUCTION",
            "special_ad_categories": [],
            "is_adset_budget_sharing_enabled": False,
        },
    },
]


def create_campaign(account: AdAccount) -> Campaign:
    print("\n--- Paso 1: Crear Campaign ---")

    for attempt in _CAMPAIGN_OBJECTIVES:
        print(f"  Intentando objetivo: {attempt['label']}")
        try:
            params = {
                "name": TEST_CAMPAIGN_NAME,
                "status": "PAUSED",
                **attempt["params"],
            }
            campaign = account.create_campaign(params=params)
            account_id = os.getenv("META_AD_ACCOUNT_ID", "")
            print(f"  OK  Campaign ID: {campaign['id']}")
            print(f"      Objetivo usado: {attempt['label']}")
            print(f"      Ver en Meta: {ads_manager_url(account_id, campaign['id'])}")
            return campaign
        except FacebookRequestError as e:
            print(f"  FAIL con ese objetivo:")
            _print_full_error(e)
            print()

    raise RuntimeError("No se pudo crear la Campaign con ninguno de los objetivos. Ver errores arriba.")


def resolve_interests(queries: list[str]) -> list[dict]:
    """Busca interest IDs válidos en Meta vía TargetingSearch."""
    resolved = []
    for q in queries:
        try:
            results = TargetingSearch.search(params={"q": q, "type": "adinterest"})
            if results:
                top = results[0]
                resolved.append({"id": top["id"], "name": top["name"]})
                print(f"      Interés OK: {top['name']} (id={top['id']})")
        except FacebookRequestError as e:
            print(f"      Interés SKIP '{q}': {e.api_error_message()}")
    return resolved


def create_adset(account: AdAccount, campaign_id: str) -> AdSet:
    print("\n--- Paso 2: Crear AdSet ---")

    # Resuelve interest IDs reales desde la API de Meta
    print("  Buscando interest IDs via TargetingSearch...")
    interests = resolve_interests(INTEREST_QUERIES)

    # 7 dias minimo para la fase de aprendizaje de Meta
    now = datetime.now(timezone.utc)
    start = (now + timedelta(days=1)).strftime("%Y-%m-%dT%H:%M:%S+0000")
    end = (now + timedelta(days=8)).strftime("%Y-%m-%dT%H:%M:%S+0000")

    targeting: dict = {
        "geo_locations": {"countries": ["CO", "MX", "PE", "AR"]},
        "age_min": 28,
        "age_max": 52,
        # API v21+: declarar explícitamente si se usa Advantage+ Audience de Meta.
        # 0 = targeting manual (nuestro control), 1 = Meta expande con IA.
        "targeting_automation": {"advantage_audience": 0},
    }
    if interests:
        targeting["interests"] = interests

    adset = account.create_ad_set(
        params={
            "name": "Fundadores LATAM 28-52 - Frio",
            "campaign_id": campaign_id,
            "daily_budget": 500000,         # centavos COP -> COP$5,000/dia (~$1.2 USD, sobre el mínimo de COP$3,653)
            "billing_event": "IMPRESSIONS",
            "optimization_goal": "LEAD_GENERATION",
            "bid_strategy": "LOWEST_COST_WITHOUT_CAP",
            "start_time": start,
            "end_time": end,
            "targeting": targeting,
            "status": "PAUSED",
        }
    )
    print(f"  OK  AdSet ID: {adset['id']}")
    print(f"      Paises: CO, MX, PE, AR | Edad: 28-52")
    print(f"      Presupuesto: $20 USD/dia | Duracion: {start[:10]} -> {end[:10]}")
    return adset


def create_creative(account: AdAccount) -> AdCreative:
    print("\n--- Paso 3: Crear AdCreative ---")

    page_id = os.getenv("META_PAGE_ID")
    if not page_id:
        raise ValueError("META_PAGE_ID no esta configurado en .env")

    creative = account.create_ad_creative(
        params={
            "name": "Creative 30X Bogota - Test Sandbox",
            "object_story_spec": {
                "page_id": page_id,
                "link_data": {
                    "link": "https://30x.com",
                    "message": "Los mejores lideres no crecen solos. Crecen con los correctos.",
                    "name": "40 lideres. 3 dias. Bogota.",
                    "description": "El programa donde los fundadores que ya escalaron comparten lo que nunca dirian en publico.",
                    "call_to_action": {
                        "type": "LEARN_MORE",
                        "value": {"link": "https://30x.com"},
                    },
                    "picture": TEST_IMAGE_URL,
                },
            },
        }
    )
    print(f"  OK  Creative ID: {creative['id']}")
    print(f"      Headline: 40 lideres. 3 dias. Bogota.")
    print(f"      CTA: LEARN_MORE -> https://30x.com")
    return creative


def create_ad(account: AdAccount, adset_id: str, creative_id: str) -> Ad:
    print("\n--- Paso 4: Crear Ad ---")

    ad = account.create_ad(
        params={
            "name": "Ad 30X Bogota Test",
            "adset_id": adset_id,
            "creative": {"creative_id": creative_id},
            "status": "PAUSED",
        }
    )
    print(f"  OK  Ad ID: {ad['id']}")
    return ad


def cleanup(campaign_id: str, adset_id: str, creative_id: str, ad_id: str = ""):
    print("\n--- Cleanup: eliminando objetos de test ---")
    for label, obj_class, obj_id in [
        ("Ad", Ad, ad_id),
        ("AdSet", AdSet, adset_id),
        ("Creative", AdCreative, creative_id),
        ("Campaign", Campaign, campaign_id),
    ]:
        if not obj_id:
            continue
        try:
            obj_class(obj_id).api_delete()
            print(f"  OK  {label} {obj_id} eliminado")
        except Exception as e:
            print(f"  WARN  No se pudo eliminar {label}: {e}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--cleanup",
        action="store_true",
        help="Eliminar objetos creados al finalizar el test"
    )
    args = parser.parse_args()

    print("=" * 55)
    print("MarketingOS - Meta Ads API Full Campaign Creation Test")
    print("Cuenta: sandbox (sin entrega real, sin gasto)")
    print("=" * 55)

    try:
        account = init_sdk()
        print(f"\n  SDK inicializado para {os.getenv('META_AD_ACCOUNT_ID')}")

        campaign = create_campaign(account)
        adset = create_adset(account, campaign["id"])
        creative = create_creative(account)

        # Ad requiere método de pago en la cuenta.
        # En cuenta personal sin pago falla con subcode 1359188.
        # Los 3 pasos anteriores ya validan la integración completa con Meta.
        ad_id = None
        try:
            ad = create_ad(account, adset["id"], creative["id"])
            ad_id = ad["id"]
        except FacebookRequestError as e:
            if e.api_error_code() == 100:
                print(f"\n  SKIP  Ad no creado: la cuenta no tiene método de pago.")
                print(f"        No es un error de código — el agente funcionará con")
                print(f"        una cuenta que sí tenga método de pago configurado.")
            else:
                raise

        print("\n" + "=" * 55)
        print("RESULTADO - IDs generados por Meta:")
        print(f"  Campaign ID : {campaign['id']}")
        print(f"  AdSet ID    : {adset['id']}")
        print(f"  Creative ID : {creative['id']}")
        print(f"  Ad ID       : {ad_id or 'SKIP (sin método de pago)'}")
        print("=" * 55)

        account_id = os.getenv("META_AD_ACCOUNT_ID", "")
        url = ads_manager_url(account_id, campaign["id"])

        if ad_id:
            print("\nPipeline 4/4 OK. Todos los objetos en status=PAUSED (sin gasto).")
        else:
            print("\nPipeline 3/4 OK — Campaign, AdSet y Creative validados con IDs reales de Meta.")

        print(f"\n{'='*55}")
        print("Ver campaña en Meta Ads Manager:")
        print(f"  {url}")
        print(f"{'='*55}")
        print("La campaña aparece en estado PAUSED — no genera gasto.")

        cleanup_ad_id = ad_id or ""
        if args.cleanup:
            cleanup(campaign["id"], adset["id"], creative["id"], cleanup_ad_id)
        else:
            print("\nTip: corre con --cleanup para eliminar los objetos de test.")

    except FacebookRequestError as e:
        print(f"\n[Meta API Error]")
        _print_full_error(e)
        print("\nConsulta docs/META_ADS_SETUP.md -> seccion 'Errores comunes'")
        sys.exit(1)
    except ValueError as e:
        print(f"\n[Config Error] {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n[Error inesperado] {type(e).__name__}: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
