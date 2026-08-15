"""Tests de campaign_metrics en supabase_client — client mockeado, sin red."""
from unittest.mock import patch

import pytest

from backend.db import supabase_client as sc


class _Result:
    def __init__(self, data):
        self.data = data


class FakeQuery:
    def __init__(self, rows=None):
        self.rows = rows if rows is not None else [{"id": "row-1"}]
        self.table_name = None
        self.payload = None
        self.on_conflict = None
        self.filters = []
        self.order_by = None
        self.limit_n = None

    def table(self, name):
        self.table_name = name
        return self

    def upsert(self, payload, on_conflict=None):
        self.payload = payload
        self.on_conflict = on_conflict
        return self

    def select(self, *_args):
        return self

    def eq(self, col, val):
        self.filters.append(("eq", col, val))
        return self

    def gte(self, col, val):
        self.filters.append(("gte", col, val))
        return self

    def lte(self, col, val):
        self.filters.append(("lte", col, val))
        return self

    def order(self, col, desc=False):
        self.order_by = (col, desc)
        return self

    def limit(self, n):
        self.limit_n = n
        return self

    def execute(self):
        return _Result(self.rows)


_VALID = {
    "account_id": "acct-a",
    "platform": "meta",
    "campaign_id": "camp_1",
    "metric_date": "2026-08-15",
    "impressions": 100,
    "spend_usd": 12.5,
}


class TestUpsertCampaignMetrics:
    def test_descarta_campos_fuera_de_whitelist(self):
        q = FakeQuery()
        extra = {**_VALID, "foo_llm": "basura", "rationale": "no va"}
        with patch.object(sc, "_get_client", return_value=q):
            sc.upsert_campaign_metrics(extra)
        assert "foo_llm" not in q.payload
        assert "rationale" not in q.payload
        assert q.payload["impressions"] == 100

    def test_upsert_usa_on_conflict_del_unique(self):
        q = FakeQuery()
        with patch.object(sc, "_get_client", return_value=q):
            row_id = sc.upsert_campaign_metrics(_VALID)
        assert q.table_name == "campaign_metrics"
        assert q.on_conflict == "account_id,platform,campaign_id,metric_date"
        assert row_id == "row-1"

    def test_sin_account_id_falla(self):
        data = {k: v for k, v in _VALID.items() if k != "account_id"}
        with pytest.raises(ValueError, match="account_id"):
            sc.upsert_campaign_metrics(data)

    def test_no_toca_campaign_fields(self):
        assert "impressions" not in sc._CAMPAIGN_FIELDS
        assert "clicks" not in sc._CAMPAIGN_FIELDS
        assert "spend_usd" not in sc._CAMPAIGN_FIELDS
        assert "metric_date" not in sc._CAMPAIGN_FIELDS


class TestListCampaignMetrics:
    def test_filtra_siempre_por_account_id(self):
        q = FakeQuery(rows=[])
        with patch.object(sc, "_get_client", return_value=q):
            sc.list_campaign_metrics(account_id="acct-a", campaign_id="camp_1")
        assert ("eq", "account_id", "acct-a") in q.filters
        assert ("eq", "campaign_id", "camp_1") in q.filters

    def test_sin_account_id_falla(self):
        with pytest.raises(ValueError, match="account_id"):
            sc.list_campaign_metrics(account_id="")

    def test_rango_de_fechas(self):
        q = FakeQuery(rows=[])
        with patch.object(sc, "_get_client", return_value=q):
            sc.list_campaign_metrics(
                account_id="acct-a",
                date_from="2026-08-01",
                date_to="2026-08-15",
            )
        assert ("gte", "metric_date", "2026-08-01") in q.filters
        assert ("lte", "metric_date", "2026-08-15") in q.filters
