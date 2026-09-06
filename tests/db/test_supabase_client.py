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
        self.range_args = None
        self.range_calls = []

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

    def is_(self, col, val):
        self.filters.append(("is", col, val))
        return self

    @property
    def not_(self):
        query = self

        class _Not:
            def is_(self, col, val):
                query.filters.append(("not.is", col, val))
                return query

        return _Not()

    def range(self, start, end):
        self.range_args = (start, end)
        self.range_calls.append((start, end))
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


class _PagingQuery(FakeQuery):
    """Devuelve una página distinta en cada execute() para probar el walker."""

    def __init__(self, pages):
        super().__init__(rows=[])
        self._pages = list(pages)
        self._idx = 0

    def execute(self):
        rows = self._pages[self._idx] if self._idx < len(self._pages) else []
        self._idx += 1
        return _Result(rows)


class TestListIngestibleCampaigns:
    def test_filtros_meta_real_con_cuenta(self):
        q = FakeQuery(rows=[])
        with patch.object(sc, "_get_client", return_value=q):
            sc.list_ingestible_campaigns()
        assert q.table_name == "campaigns"
        assert ("eq", "platform", "meta") in q.filters
        assert ("eq", "is_mock", False) in q.filters
        assert ("is", "deleted_at", "null") in q.filters
        assert ("not.is", "account_id", "null") in q.filters
        assert q.limit_n is None

    def test_no_usa_list_campaigns(self):
        q = FakeQuery(rows=[])
        with patch.object(sc, "_get_client", return_value=q):
            with patch.object(sc, "list_campaigns") as listed:
                sc.list_ingestible_campaigns()
                listed.assert_not_called()

    def test_paginacion_recorre_todas_las_paginas(self):
        page1 = [{"campaign_id": f"c{i}", "account_id": "a"} for i in range(3)]
        page2 = [{"campaign_id": "c3", "account_id": "a"}]
        q = _PagingQuery([page1, page2])
        with patch.object(sc, "_get_client", return_value=q):
            rows = sc.list_ingestible_campaigns(page_size=3)
        assert [r["campaign_id"] for r in rows] == ["c0", "c1", "c2", "c3"]
        assert q.range_calls == [(0, 2), (3, 5)]

