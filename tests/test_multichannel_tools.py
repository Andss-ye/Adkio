"""
Tests de los tools multicanal nuevos:
- platform_recommender
- campaign_remover
- campaign_launcher (con routing por plataforma)
"""
from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from backend.tools.campaign_launcher import campaign_launcher, _infer_platform
from backend.tools.campaign_remover import campaign_remover
from backend.tools.platform_recommender import platform_recommender


# ── platform_recommender ────────────────────────────────────────────────────

def _audience(edad_min=25, edad_max=55, intereses=None):
    return {
        "edad_min": edad_min,
        "edad_max": edad_max,
        "intereses": intereses or [],
    }


def test_recommender_picks_meta_for_leads_b2b(brand_config):
    out = platform_recommender(
        objetivo="Generar leads para evento de fundadores en Bogotá",
        audiencia=_audience(28, 52),
        brand_config=brand_config,
    )
    assert out["platform"] == "meta"
    assert out["confidence"] > 0.7
    assert "estructura_recomendada" in out
    assert out["estructura_recomendada"]["notas"]


def test_recommender_picks_tiktok_for_young_awareness(brand_config):
    out = platform_recommender(
        objetivo="Dar awareness viral de la marca en jóvenes",
        audiencia=_audience(18, 28),
        brand_config=brand_config,
    )
    assert out["platform"] == "tiktok"
    assert out["confidence"] > 0.6


def test_recommender_picks_google_for_intent_search(brand_config):
    out = platform_recommender(
        objetivo="Captar usuarios que comparan precios y buscan cotizar",
        audiencia=_audience(30, 50),
        brand_config=brand_config,
    )
    assert out["platform"] == "google_ads"
    assert out["confidence"] > 0.7


def test_recommender_returns_alternatives(brand_config):
    out = platform_recommender(
        objetivo="leads de educación ejecutiva",
        audiencia=_audience(30, 50),
        brand_config=brand_config,
    )
    assert len(out["alternativas"]) == 2
    # Ordenadas por confianza descendente
    confidences = [a["confidence"] for a in out["alternativas"]]
    assert confidences == sorted(confidences, reverse=True)


def test_recommender_structure_for_meta_scales_with_budget(brand_config):
    low = platform_recommender(
        objetivo="leads",
        audiencia=_audience(30, 50),
        brand_config=brand_config,
        presupuesto_usd=100,
    )
    high = platform_recommender(
        objetivo="leads",
        audiencia=_audience(30, 50),
        brand_config=brand_config,
        presupuesto_usd=500,
    )
    if low["platform"] == "meta" and high["platform"] == "meta":
        assert (
            high["estructura_recomendada"]["ad_sets_per_campaign"]
            >= low["estructura_recomendada"]["ad_sets_per_campaign"]
        )


def test_recommender_rationale_mentions_platform(brand_config):
    out = platform_recommender(
        objetivo="leads",
        audiencia=_audience(30, 50),
        brand_config=brand_config,
    )
    assert out["platform"] in out["rationale"]


# ── campaign_launcher routing ──────────────────────────────────────────────

def test_infer_platform_from_canal():
    assert _infer_platform("instagram") == "meta"
    assert _infer_platform("facebook") == "meta"
    assert _infer_platform("tiktok") == "tiktok"
    assert _infer_platform("google_search") == "google_ads"
    assert _infer_platform("youtube") == "google_ads"
    assert _infer_platform("desconocido") == "meta"  # default


def test_launcher_falls_back_to_mock_without_creds():
    """Sin credenciales para tiktok, el launcher debe devolver mock — no crashear."""
    resolver = MagicMock()
    resolver.resolve.return_value = None
    result = campaign_launcher(
        canal="tiktok",
        copy={"headline": "Demo"},
        targeting={"tamano_estimado": 500_000},
        budget=200.0,
        duracion_dias=10,
        platform="tiktok",
        resolver=resolver,
    )
    assert result["platform"] == "tiktok"
    assert result["status"] == "PAUSED"
    assert "mock" in result["campaign_id"].lower()
    assert "mock" in result["rationale"].lower()


def test_launcher_routes_to_adapter_when_creds_present(monkeypatch):
    """Con credenciales, el launcher invoca al adapter correcto."""
    from backend.integrations.base import CreateResult

    resolver = MagicMock()
    resolver.resolve.return_value = MagicMock()  # creds fakes

    fake_adapter = MagicMock()
    fake_adapter.create_campaign.return_value = CreateResult(
        platform="tiktok",
        campaign_id="tt_real_999",
        status="DISABLE",
        preview_url="https://ads.tiktok.com/i18n/perf/campaign?...",
        rationale="Campaña creada en TikTok",
    )

    monkeypatch.setattr(
        "backend.tools.campaign_launcher.get_adapter",
        lambda p: fake_adapter,
    )

    result = campaign_launcher(
        canal="tiktok",
        copy={"headline": "Demo"},
        targeting={"tamano_estimado": 800_000},
        budget=300.0,
        duracion_dias=10,
        platform="tiktok",
        resolver=resolver,
    )
    assert result["platform"] == "tiktok"
    assert result["campaign_id"] == "tt_real_999"
    assert result["status"] == "DISABLE"
    fake_adapter.create_campaign.assert_called_once()


def test_launcher_next_steps_are_platform_specific():
    resolver = MagicMock()
    resolver.resolve.return_value = None  # forzar mock

    r_meta = campaign_launcher(
        canal="instagram",
        copy={"headline": "X"},
        targeting={"tamano_estimado": 500_000},
        budget=100,
        duracion_dias=7,
        platform="meta",
        resolver=resolver,
    )
    r_tt = campaign_launcher(
        canal="tiktok",
        copy={"headline": "X"},
        targeting={"tamano_estimado": 500_000},
        budget=100,
        duracion_dias=7,
        platform="tiktok",
        resolver=resolver,
    )
    r_google = campaign_launcher(
        canal="google_search",
        copy={"headline": "X"},
        targeting={"tamano_estimado": 500_000},
        budget=100,
        duracion_dias=7,
        platform="google_ads",
        resolver=resolver,
    )
    # Cada plataforma tiene next_steps distintos
    assert r_meta["next_steps"] != r_tt["next_steps"]
    assert r_tt["next_steps"] != r_google["next_steps"]
    assert "TikTok" in " ".join(r_tt["next_steps"])
    assert "Quality Score" in " ".join(r_google["next_steps"])


def test_launcher_unknown_platform_falls_back_to_mock():
    resolver = MagicMock()
    result = campaign_launcher(
        canal="linkedin",
        copy={"headline": "X"},
        targeting={"tamano_estimado": 500_000},
        budget=100,
        duracion_dias=7,
        platform="linkedin",  # no soportada
        resolver=resolver,
    )
    assert "mock" in result["campaign_id"].lower()


# ── campaign_remover ───────────────────────────────────────────────────────

def test_remover_requires_confirmation_by_default():
    result = campaign_remover(platform="meta", campaign_id="123", confirm=False)
    assert result["deleted"] is False
    assert result["requires_confirmation"] is True
    assert "confirm" in result["rationale"].lower()


def test_remover_warns_about_soft_delete_for_tiktok():
    result = campaign_remover(platform="tiktok", campaign_id="tt_1", confirm=False)
    assert result["soft_delete"] is True
    assert "desactivará" in result["rationale"] or "soft-delete" in result["rationale"].lower()


def test_remover_warns_about_hard_delete_for_meta():
    result = campaign_remover(platform="meta", campaign_id="m_1", confirm=False)
    assert result["soft_delete"] is False
    assert "permanente" in result["rationale"].lower() or "no se puede recuperar" in result["rationale"].lower()


def test_remover_rejects_unknown_platform():
    result = campaign_remover(platform="linkedin", campaign_id="x", confirm=True)
    assert result["deleted"] is False
    assert "no soportada" in result["rationale"].lower()


def test_remover_no_creds_returns_clean_error():
    resolver = MagicMock()
    resolver.resolve.return_value = None
    result = campaign_remover(
        platform="meta", campaign_id="m_1", confirm=True, resolver=resolver
    )
    assert result["deleted"] is False
    assert "no está conectada" in result["rationale"].lower() or "credenciales" in result["rationale"].lower()


def test_remover_dispatches_to_adapter_on_confirm(monkeypatch):
    from backend.integrations.base import DeleteResult

    resolver = MagicMock()
    resolver.resolve.return_value = MagicMock()

    fake_adapter = MagicMock()
    fake_adapter.delete_campaign.return_value = DeleteResult(
        platform="meta",
        campaign_id="m_1",
        deleted=True,
        soft_delete=False,
        platform_status_after="DELETED",
        rationale="Eliminada de Meta",
    )
    monkeypatch.setattr(
        "backend.tools.campaign_remover.get_adapter",
        lambda p: fake_adapter,
    )

    result = campaign_remover(
        platform="meta", campaign_id="m_1", confirm=True, resolver=resolver
    )
    assert result["deleted"] is True
    assert result["platform_status_after"] == "DELETED"
    fake_adapter.delete_campaign.assert_called_once()


def test_remover_dispatches_soft_delete_for_tiktok(monkeypatch):
    from backend.integrations.base import DeleteResult

    resolver = MagicMock()
    resolver.resolve.return_value = MagicMock()

    fake_adapter = MagicMock()
    fake_adapter.delete_campaign.return_value = DeleteResult(
        platform="tiktok",
        campaign_id="tt_1",
        deleted=True,
        soft_delete=True,
        platform_status_after="DISABLE",
        rationale="Soft-delete en TikTok",
    )
    monkeypatch.setattr(
        "backend.tools.campaign_remover.get_adapter",
        lambda p: fake_adapter,
    )

    result = campaign_remover(
        platform="tiktok", campaign_id="tt_1", confirm=True, resolver=resolver
    )
    assert result["deleted"] is True
    assert result["soft_delete"] is True
    assert result["platform_status_after"] == "DISABLE"
