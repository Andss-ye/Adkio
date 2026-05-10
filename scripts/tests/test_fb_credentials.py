import os
import sys
from dotenv import load_dotenv
from facebook_business.api import FacebookAdsApi
from facebook_business.adobjects.adaccount import AdAccount
from facebook_business.adobjects.page import Page
from facebook_business.exceptions import FacebookRequestError

# Cargar variables de entorno desde el archivo .env
load_dotenv()

# Obtener credenciales
access_token = os.getenv('ACCESS_TOKEN')
app_secret = os.getenv('APP_SECRET')
app_id = os.getenv('APP_ID')
ad_account_id_raw = os.getenv('AD_ACCOUNT_ID')
page_id = os.getenv('PAGE_ID')

# Validar que las variables se cargaron correctamente
if not all([access_token, app_secret, app_id, ad_account_id_raw, page_id]):
    print("❌ Error: Faltan variables en el archivo .env (asegúrate de incluir PAGE_ID)")
    sys.exit(1)

# Asegurarse de que el ID de la cuenta tenga el prefijo 'act_'
ad_account_id = f"act_{ad_account_id_raw}" if not ad_account_id_raw.startswith('act_') else ad_account_id_raw

try:
    print("Iniciando la API de Facebook usando variables del archivo .env...")
    FacebookAdsApi.init(app_id, app_secret, access_token)
    
    print(f"Obteniendo información de la cuenta de anuncios: {ad_account_id}...")
    account = AdAccount(ad_account_id)
    
    # Solicitando campos básicos para probar la conectividad y permisos
    account_info = account.api_get(fields=['id', 'name', 'account_status'])
    
    print("\n✅ ¡Conexión exitosa a la cuenta de anuncios!")
    print("Información de la cuenta:")
    print(f"- ID: {account_info.get('id')}")
    print(f"- Nombre: {account_info.get('name')}")
    print(f"- Estado de la cuenta: {account_info.get('account_status')} (1 = Activa, 2 = Desactivada, 3 = Sin liquidar, etc.)")

    print(f"\nObteniendo información de la página: {page_id}...")
    page = Page(page_id)
    page_info = page.api_get(fields=['id', 'name'])
    
    print("\n✅ ¡Conexión exitosa a la página!")
    print("Información de la página:")
    print(f"- ID: {page_info.get('id')}")
    print(f"- Nombre: {page_info.get('name')}")
    
except FacebookRequestError as e:
    print("\n❌ Error de Facebook API:")
    print(f"Mensaje: {e.api_error_message()}")
    print(f"Tipo de error: {e.api_error_type()}")
    print(f"Código: {e.api_error_code()}")
    sys.exit(1)
except Exception as e:
    print("\n❌ Error inesperado:")
    print(e)
    sys.exit(1)
