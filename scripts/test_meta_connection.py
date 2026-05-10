"""
Test 1: Smoke test de conexión a Meta Marketing API.
Verifica que el SDK esté inicializado y la cuenta sandbox sea accesible.

Uso:
    python scripts/test_meta_connection.py
"""
import os
import sys
from pathlib import Path

# Permite importar desde la raíz del proyecto
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv()

from facebook_business.api import FacebookAdsApi
from facebook_business.adobjects.adaccount import AdAccount
from facebook_business.exceptions import FacebookRequestError


def check_env() -> bool:
    required = ["META_APP_ID", "META_ACCESS_TOKEN", "META_AD_ACCOUNT_ID"]
    missing = [k for k in required if not os.getenv(k)]
    if missing:
        print(f"[ERROR] Variables faltantes en .env: {', '.join(missing)}")
        return False
    return True


def test_sdk_init() -> bool:
    print("\n--- Test 1: SDK Init ---")
    try:
        FacebookAdsApi.init(
            app_id=os.getenv("META_APP_ID"),
            app_secret=os.getenv("META_APP_SECRET", ""),
            access_token=os.getenv("META_ACCESS_TOKEN"),
        )
        print("  OK  SDK inicializado")
        return True
    except Exception as e:
        print(f"  FAIL  Error inicializando SDK: {e}")
        return False


def test_account_read() -> bool:
    print("\n--- Test 2: Leer Ad Account ---")
    try:
        account_id = os.getenv("META_AD_ACCOUNT_ID")
        account = AdAccount(account_id)
        info = account.api_get(fields=[
            "name",
            "account_status",
            "currency",
            "timezone_name",
            "is_personal",
        ])
        print(f"  OK  Cuenta: {info.get('name')}")
        print(f"      ID: {account_id}")
        print(f"      Status: {info.get('account_status')} (1=activa, 2=deshabilitada)")
        print(f"      Moneda: {info.get('currency')}")
        print(f"      Timezone: {info.get('timezone_name')}")
        print(f"      Is personal: {info.get('is_personal')}")
        return True
    except FacebookRequestError as e:
        print(f"  FAIL  Error de Meta API: {e.api_error_message()}")
        print(f"        Código: {e.api_error_code()}")
        return False


def test_list_campaigns() -> bool:
    print("\n--- Test 3: Listar campañas existentes ---")
    try:
        account = AdAccount(os.getenv("META_AD_ACCOUNT_ID"))
        campaigns = account.get_campaigns(fields=["name", "objective", "status"])
        print(f"  OK  {len(campaigns)} campaña(s) encontrada(s) en la cuenta")
        for c in campaigns:
            print(f"      - [{c.get('status')}] {c.get('name')} / {c.get('objective')}")
        if not campaigns:
            print("      (cuenta limpia — normal en sandbox nuevo)")
        return True
    except FacebookRequestError as e:
        print(f"  FAIL  Error de Meta API: {e.api_error_message()}")
        print(f"        Código: {e.api_error_code()}")
        return False


def test_page_access() -> bool:
    print("\n--- Test 4: Verificar Page ID ---")
    page_id = os.getenv("META_PAGE_ID")
    if not page_id:
        print("  SKIP  META_PAGE_ID no configurado en .env")
        return True

    try:
        from facebook_business.adobjects.page import Page
        page = Page(page_id)
        info = page.api_get(fields=["name", "category"])
        print(f"  OK  Page: {info.get('name')} (ID: {page_id})")
        print(f"      Categoría: {info.get('category')}")
        return True
    except FacebookRequestError as e:
        print(f"  WARN  No se pudo leer la Page: {e.api_error_message()}")
        print("        Esto es normal si la Page no está conectada al token del sandbox")
        return True  # No bloqueante


def main():
    print("=" * 50)
    print("MarketingOS — Meta Ads API Smoke Test")
    print("=" * 50)

    if not check_env():
        sys.exit(1)

    results = {
        "SDK Init": test_sdk_init(),
        "Ad Account": test_account_read(),
        "Campaigns": test_list_campaigns(),
        "Page": test_page_access(),
    }

    print("\n" + "=" * 50)
    print("Resumen:")
    all_ok = True
    for name, ok in results.items():
        status = "OK  " if ok else "FAIL"
        if not ok:
            all_ok = False
        print(f"  [{status}] {name}")

    if all_ok:
        print("\nTodo OK. Puedes correr test_meta_campaign.py")
    else:
        print("\nAlgunos tests fallaron. Revisa el .env y los permisos del token.")
        sys.exit(1)


if __name__ == "__main__":
    main()
