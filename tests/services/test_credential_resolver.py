"""
Tests del EnvCredentialResolver — verifica el mapeo env → dataclass por plataforma.
"""
from __future__ import annotations

import pytest

from backend.integrations.credentials import GoogleAdsCreds, MetaCreds, TikTokCreds
from backend.services.credential_resolver import (
    CredentialResolver,
    EnvCredentialResolver,
)


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
