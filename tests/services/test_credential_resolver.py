"""
Tests del EnvCredentialResolver — verifica el mapeo env → dataclass por plataforma.
"""
from __future__ import annotations

from unittest.mock import patch

import pytest

from backend.integrations.credentials import GoogleAdsCreds, MetaCreds, TikTokCreds
from backend.services.credential_resolver import (
    CredentialResolver,
    EnvCredentialResolver,
)
from tests.conftest import FakeSupabase


def test_satisfies_protocol():
    assert isinstance(EnvCredentialResolver(environ={}), CredentialResolver)


def test_resolve_meta_full_env():
    env = {
        "META_APP_ID": "1",
        "META_APP_SECRET": "s",
        "META_ACCESS_TOKEN": "tok",
        "META_AD_ACCOUNT_ID": "act_999",
        "META_PAGE_ID": "p1",
    }
    creds = EnvCredentialResolver(environ=env).resolve("meta")
    assert isinstance(creds, MetaCreds)
    assert creds.app_id == "1"
    assert creds.ad_account_id == "act_999"
    assert creds.page_id == "p1"


def test_resolve_meta_accepts_legacy_names():
    """Compat con APP_ID / ACCESS_TOKEN sin prefijo META_."""
    env = {
        "APP_ID": "1",
        "ACCESS_TOKEN": "tok",
        "AD_ACCOUNT_ID": "999",
    }
    creds = EnvCredentialResolver(environ=env).resolve("meta")
    assert creds is not None
    assert creds.app_id == "1"
    assert creds.normalized_ad_account_id == "act_999"


def test_resolve_meta_returns_none_when_incomplete():
    env = {"META_APP_ID": "1"}  # faltan token y account
    assert EnvCredentialResolver(environ=env).resolve("meta") is None


def test_resolve_meta_strips_quotes_and_whitespace():
    env = {
        "META_APP_ID": "  '1'  ",
        "META_ACCESS_TOKEN": '"tok"',
        "META_AD_ACCOUNT_ID": "act_999",
    }
    creds = EnvCredentialResolver(environ=env).resolve("meta")
    assert creds.app_id == "1"
    assert creds.access_token == "tok"


def test_resolve_tiktok_full_env():
    env = {
        "TIKTOK_ACCESS_TOKEN": "tok",
        "TIKTOK_ADVERTISER_ID": "adv_1",
        "TIKTOK_APP_ID": "app",
        "TIKTOK_APP_SECRET": "secret",
        "TIKTOK_USE_SANDBOX": "true",
    }
    creds = EnvCredentialResolver(environ=env).resolve("tiktok")
    assert isinstance(creds, TikTokCreds)
    assert creds.access_token == "tok"
    assert creds.sandbox is True


def test_resolve_tiktok_returns_none_when_incomplete():
    env = {"TIKTOK_ACCESS_TOKEN": "tok"}
    assert EnvCredentialResolver(environ=env).resolve("tiktok") is None


def test_resolve_google_full_env():
    env = {
        "GOOGLE_ADS_DEVELOPER_TOKEN": "d",
        "GOOGLE_ADS_CLIENT_ID": "c",
        "GOOGLE_ADS_CLIENT_SECRET": "cs",
        "GOOGLE_ADS_REFRESH_TOKEN": "rt",
        "GOOGLE_ADS_CUSTOMER_ID": "123-456-7890",
        "GOOGLE_ADS_LOGIN_CUSTOMER_ID": "987-654-3210",
    }
    creds = EnvCredentialResolver(environ=env).resolve("google_ads")
    assert isinstance(creds, GoogleAdsCreds)
    assert creds.normalized_customer_id == "1234567890"
    assert creds.login_customer_id == "987-654-3210"


def test_resolve_google_returns_none_when_incomplete():
    env = {"GOOGLE_ADS_DEVELOPER_TOKEN": "d", "GOOGLE_ADS_CLIENT_ID": "c"}
    assert EnvCredentialResolver(environ=env).resolve("google_ads") is None


def test_resolve_rejects_unknown_platform():
    with pytest.raises(ValueError):
        EnvCredentialResolver(environ={}).resolve("linkedin")


def test_resolve_returns_none_for_unconfigured_platform():
    """Sin env vars no se asume nada — devuelve None para que el caller decida."""
    resolver = EnvCredentialResolver(environ={})
    assert resolver.resolve("meta") is None
    assert resolver.resolve("tiktok") is None
    assert resolver.resolve("google_ads") is None


# ── DBCredentialResolver — la elección del cliente en platform_assets ──────

_CONNECTION = {
    "id": "conn-1",
    "provider_account_id": "act_vieja",
    "access_token_encrypted": "cifrado",
    "extra_jsonb": {"app_id": "1", "app_secret": "s", "page_id": "page_del_env"},
}


def _resolver(responses):
    """DBCredentialResolver con un Supabase doble y `decrypt_token` neutralizado."""
    from backend.services.credential_resolver import DBCredentialResolver

    return DBCredentialResolver("acct-a", FakeSupabase(responses=responses))


def test_db_resolver_usa_el_asset_elegido_por_el_cliente():
    resolver = _resolver([
        [_CONNECTION],
        [
            {"asset_type": "ad_account", "external_id": "act_elegida"},
            {"asset_type": "page", "external_id": "page_del_cliente"},
        ],
    ])
    with patch("backend.security.token_crypto.decrypt_token", return_value="tok"):
        creds = resolver.resolve("meta")
    assert creds.ad_account_id == "act_elegida"
    assert creds.page_id == "page_del_cliente"


def test_db_resolver_cae_al_provider_account_id_sin_assets():
    """Conexión anterior a la migración 007: sigue publicando como siempre."""
    resolver = _resolver([[_CONNECTION], []])
    with patch("backend.security.token_crypto.decrypt_token", return_value="tok"):
        creds = resolver.resolve("meta")
    assert creds.ad_account_id == "act_vieja"
    assert creds.page_id == "page_del_env"


def test_db_resolver_degrada_si_la_tabla_no_existe():
    """Sin `platform_assets` en la DB el lanzamiento no puede romperse."""
    resolver = _resolver([[_CONNECTION], RuntimeError("relation platform_assets does not exist")])
    with patch("backend.security.token_crypto.decrypt_token", return_value="tok"):
        creds = resolver.resolve("meta")
    assert creds.ad_account_id == "act_vieja"


def test_db_resolver_filtra_assets_por_conexion():
    resolver = _resolver([[_CONNECTION], []])
    with patch("backend.security.token_crypto.decrypt_token", return_value="tok"):
        resolver.resolve("meta")
    assets_call = resolver._db.calls[1]
    assert assets_call["table"] == "platform_assets"
    assert ("connection_id", "conn-1") in assets_call["filters"]


def test_db_resolver_tiktok_usa_el_advertiser_elegido():
    resolver = _resolver([
        [{**_CONNECTION, "provider_account_id": "adv_vieja"}],
        [{"asset_type": "ad_account", "external_id": "adv_elegida"}],
    ])
    with patch("backend.security.token_crypto.decrypt_token", return_value="tok"):
        creds = resolver.resolve("tiktok")
    assert creds.advertiser_id == "adv_elegida"


def test_db_resolver_sin_conexion_devuelve_none():
    resolver = _resolver([[]])
    assert resolver.resolve("meta") is None
