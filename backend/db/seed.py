"""
Seed del registro demo-edu-latam en Supabase.
Ejecutar una sola vez: python backend/db/seed.py
El Objetivo A depende de este registro para testear.
"""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from dotenv import load_dotenv
load_dotenv()

from backend.db.supabase_client import get_brand_config, create_brand_config, upsert_brand_config

DEMO_BRAND = {
    "slug": "demo-edu-latam",
    "negocio_nombre": "AcademiaEjecutiva LATAM",
    "negocio_industria": "educacion ejecutiva / networking empresarial",
    "propuesta_de_valor": "Inmersiones presenciales y online para fundadores y CEOs que quieren escalar aprendiendo de quienes ya lo hicieron",
    "publico_roles": ["Founder", "CEO", "Co-founder", "Director General"],
    "publico_paises": ["Colombia", "Mexico", "Peru", "Argentina"],
    "publico_edad_min": 28,
    "publico_edad_max": 52,
    "publico_intereses": [
        "entrepreneurship",
        "business networking",
        "leadership development",
        "startup company",
        "venture capital",
        "Harvard Business Review",
    ],
    "presupuesto_min_campana_usd": 100.0,
    "presupuesto_max_campana_usd": 500.0,
    "tono_estilo": ["aspiracional", "directo", "basado en pares"],
    "tono_evitar": [
        "lenguaje de autoayuda",
        "promesas vacias",
        "tono academico universitario",
    ],
    "ejemplos_copy_aprobado": [
        "¿Cuantas decisiones importantes tomas completamente solo?",
        "Los mejores lideres no crecen solos. Crecen con los correctos.",
    ],
    "pixel_configurado": False,
}


def main():
    print("=" * 50)
    print("Adkio — Seed demo-edu-latam")
    print("=" * 50)

    existing = get_brand_config("demo-edu-latam")
    if existing:
        print(f"\n  SKIP  El registro 'demo-edu-latam' ya existe (id={existing['id']})")
        print("        Usa --force para sobreescribirlo.")
        if "--force" not in sys.argv:
            return

    brand_id = upsert_brand_config(DEMO_BRAND)
    print(f"\n  OK  Registro insertado con id={brand_id}")
    print(f"      slug: demo-edu-latam")
    print(f"      Marca: {DEMO_BRAND['negocio_nombre']}")

    verify = get_brand_config("demo-edu-latam")
    assert verify is not None, "Verificacion fallida: no se encontro el registro recien insertado"
    print(f"\n  OK  Verificacion: get_brand_config('demo-edu-latam') retorna datos correctamente")
    print("\nSeed completado. El Objetivo A puede usar brand_id='demo-edu-latam'.")


if __name__ == "__main__":
    main()
