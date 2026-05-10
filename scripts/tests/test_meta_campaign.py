import os
import sys
import argparse
from datetime import datetime, timedelta
from dotenv import load_dotenv
from facebook_business.api import FacebookAdsApi
from facebook_business.adobjects.adaccount import AdAccount
from facebook_business.adobjects.campaign import Campaign
from facebook_business.adobjects.adset import AdSet
from facebook_business.adobjects.adcreative import AdCreative
from facebook_business.adobjects.targetingsearch import TargetingSearch
from facebook_business.adobjects.page import Page
from facebook_business.exceptions import FacebookRequestError

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--cleanup', action='store_true', help='Clean up created objects')
    args = parser.parse_args()

    load_dotenv()

    access_token = os.getenv('ACCESS_TOKEN')
    app_secret = os.getenv('APP_SECRET')
    app_id = os.getenv('APP_ID')
    ad_account_id_raw = os.getenv('AD_ACCOUNT_ID')
    page_id = os.getenv('PAGE_ID')

    if not all([access_token, app_secret, app_id, ad_account_id_raw, page_id]):
        print("❌ Error: Faltan variables en el archivo .env (ACCESS_TOKEN, APP_SECRET, APP_ID, AD_ACCOUNT_ID, PAGE_ID)")
        sys.exit(1)

    ad_account_id = f"act_{ad_account_id_raw}" if not ad_account_id_raw.startswith('act_') else ad_account_id_raw

    print("==================================================")
    print("MarketingOS — Meta Ads API Smoke Test")
    print("==================================================\n")

    try:
        # Test 1: SDK Init
        print("--- Test 1: SDK Init ---")
        FacebookAdsApi.init(app_id, app_secret, access_token)
        print("  [OK] SDK inicializado\n")
        
        # Test 2: Leer Ad Account
        print("--- Test 2: Leer Ad Account ---")
        account = AdAccount(ad_account_id)
        account_info = account.api_get(fields=['id', 'name', 'account_status', 'currency', 'timezone_name', 'is_personal'])
        print(f"  [OK] Cuenta: {account_info.get('name')}")
        print(f"      ID: {account_info.get('id')}")
        print(f"      Status: {account_info.get('account_status')} (1=activa, 2=deshabilitada)")
        print(f"      Moneda: {account_info.get('currency')}")
        print(f"      Timezone: {account_info.get('timezone_name')}")
        print(f"      Is personal: {account_info.get('is_personal')}\n")

        # Test 3: Listar campañas existentes
        print("--- Test 3: Listar campañas existentes ---")
        campaigns = account.get_campaigns(fields=['name', 'status', 'objective', 'start_time'])
        print(f"  [OK] {len(campaigns)} campaña(s) encontrada(s) en la cuenta")
        for i, camp in enumerate(campaigns[:5]):
            print(f"      - [{camp.get('status')}] {camp.get('name')} - {camp.get('start_time')} / {camp.get('objective')}")
        if len(campaigns) > 5:
            print("      ...")
        print("\n")

        # Test 4: Verificar Page ID
        print("--- Test 4: Verificar Page ID ---")
        try:
            page = Page(page_id)
            page_info = page.api_get(fields=['id', 'name'])
            print(f"  [OK] Page ID validado: {page_info.get('name')} (ID: {page_info.get('id')})\n")
        except FacebookRequestError as e:
            print(f"  [WARN] No se pudo leer la Page: {e.api_error_message()}")
            print("        Esto es normal si la Page no está conectada al token del sandbox\n")

        print("==================================================")
        print("Resumen:")
        print("  [OK  ] SDK Init")
        print("  [OK  ] Ad Account")
        print("  [OK  ] Campaigns")
        print("  [OK/WARN] Page\n")
        
        print("=======================================================")
        print("MarketingOS - Meta Ads API Full Campaign Creation Test")
        print("Cuenta: sandbox (sin entrega real, sin gasto)")
        print("=======================================================\n")
        
        print(f"  SDK inicializado para {ad_account_id}\n")

        # Paso 1: Crear Campaign
        print("--- Paso 1: Crear Campaign ---")
        print("  Intentando objetivo: OUTCOME_LEADS con presupuesto por AdSet (recomendado)")
        
        campaign = account.create_campaign(
            params={
                Campaign.Field.name: f'[TEST] 30X Bogota Sandbox - {datetime.now().strftime("%Y-%m-%d %H:%M")}',
                Campaign.Field.objective: 'OUTCOME_LEADS',
                Campaign.Field.status: Campaign.Status.paused,
                Campaign.Field.special_ad_categories: ['NONE'],
                'is_adset_budget_sharing_enabled': False
            }
        )
        print(f"  [OK] Campaign ID: {campaign.get('id')}")
        print("      Objetivo usado: OUTCOME_LEADS con presupuesto por AdSet (recomendado)\n")

        # Paso 2: Crear AdSet
        print("--- Paso 2: Crear AdSet ---")
        print("  Buscando interest IDs via TargetingSearch...")
        
        interests_to_search = ['Entrepreneurship', 'Leadership', 'Small business']
        target_interests = []
        for interest in interests_to_search:
            params = {
                'type': 'adinterest',
                'q': interest,
            }
            results = TargetingSearch.search(params=params)
            if results:
                target_interests.append({'id': results[0]['id'], 'name': results[0]['name']})
                print(f"      Interés OK: {results[0]['name']} (id={results[0]['id']})")
            else:
                print(f"      Interés no encontrado: {interest}")

        start_time = datetime.now() + timedelta(days=1)
        end_time = start_time + timedelta(days=7)
        
        adset = account.create_ad_set(
            params={
                AdSet.Field.name: 'Test AdSet - Latam',
                AdSet.Field.campaign_id: campaign.get('id'),
                AdSet.Field.daily_budget: 5000,
                AdSet.Field.billing_event: 'IMPRESSIONS',
                AdSet.Field.optimization_goal: 'LEAD_GENERATION',
                AdSet.Field.bid_amount: 100,
                AdSet.Field.promoted_object: {'page_id': page_id},
                AdSet.Field.targeting: {
                    'geo_locations': {'countries': ['CO', 'MX', 'PE', 'AR']},
                    'age_min': 28,
                    'age_max': 52,
                    'flexible_spec': [{'interests': target_interests}],
                    'targeting_automation': {'advantage_audience': 0}
                },
                AdSet.Field.start_time: start_time.isoformat(),
                AdSet.Field.end_time: end_time.isoformat(),
                AdSet.Field.status: AdSet.Status.paused,
            }
        )
        print(f"  [OK] AdSet ID: {adset.get('id')}")
        print("      Paises: CO, MX, PE, AR | Edad: 28-52")
        print(f"      Presupuesto: $20/dia | Duracion: {start_time.strftime('%Y-%m-%d')} -> {end_time.strftime('%Y-%m-%d')}\n")

        # Paso 3: Crear AdCreative
        print("--- Paso 3: Crear AdCreative ---")
        try:
            creative = account.create_ad_creative(
                params={
                    AdCreative.Field.name: 'Test Creative',
                    AdCreative.Field.object_story_spec: {
                        'page_id': page_id,
                        'link_data': {
                            'image_hash': '', # No proporcionado, fallará o se requerirá después
                            'link': 'https://adkio.com',
                            'message': 'Test message for sandbox',
                        }
                    }
                }
            )
            print(f"  [OK] AdCreative ID: {creative.get('id')}")
        except FacebookRequestError as e:
            print("\n[Meta API Error]")
            print(f"  Mensaje    : {e.api_error_message()}")
            print(f"  Codigo     : {e.api_error_code()}")
            print(f"  Tipo       : {e.api_error_type()}")
            print(f"  Subcode    : {e.api_error_subcode()}")
            error_data = e.body().get('error', {}) if hasattr(e, 'body') and callable(e.body) else {}
            print(f"  User msg   : {error_data.get('error_user_msg', 'n/a')}")
            print(f"  User title : {error_data.get('error_user_title', 'n/a')}")
            print("  Blame      : n/a")
            print("\nConsulta docs/META_ADS_SETUP.md -> seccion 'Errores comunes'")

    except FacebookRequestError as e:
        print("\n[Meta API Error Fatal]")
        print(f"  Mensaje    : {e.api_error_message()}")
        print(f"  Codigo     : {e.api_error_code()}")
        print(f"  Tipo       : {e.api_error_type()}")
        print(f"  Subcode    : {e.api_error_subcode()}")
        print(f"  User msg   : {e.body().get('error', {}).get('error_user_msg', 'n/a') if hasattr(e, 'body') and callable(e.body) else 'n/a'}")
        print(f"  User title : {e.body().get('error', {}).get('error_user_title', 'n/a') if hasattr(e, 'body') and callable(e.body) else 'n/a'}")
        print("  Blame      : n/a")
        sys.exit(1)
    except Exception as e:
        print(f"\n[Error Inesperado] {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()