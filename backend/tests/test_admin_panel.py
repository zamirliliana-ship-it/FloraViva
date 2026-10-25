"""Pruebas del panel administrativo (métricas y foro). Ejecutar con:  pytest"""
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.routers import admin_panel as panel

# 25-oct-2026 02:30 UTC = 24-oct-2026 21:30 en Colombia (UTC-5).
AHORA = datetime(2026, 10, 25, 2, 30, tzinfo=timezone.utc)


class FakeQuery:
    """Imita lo mínimo del cliente de Supabase que usa el panel."""

    def __init__(self, filas):
        self.filas = list(filas)
        self.contar = False
        self.desde = self.hasta = None
        self.columna_fecha = None
        self.inicio, self.fin = 0, None
        self.columnas = None

    def select(self, columnas="*", count=None):
        self.columnas = columnas
        self.contar = count == "exact"
        return self

    def gte(self, columna, valor):
        self.columna_fecha, self.desde = columna, valor
        return self

    def lt(self, columna, valor):
        self.columna_fecha, self.hasta = columna, valor
        return self

    def order(self, *_, **__):
        return self

    def limit(self, *_):
        return self

    def range(self, inicio, fin):
        self.inicio, self.fin = inicio, fin
        return self

    def execute(self):
        filas = self.filas
        if self.columna_fecha:
            c = self.columna_fecha
            if any(c not in f for f in filas):
                raise RuntimeError(f"columna {c} no existe")
            filas = [
                f for f in filas
                if (self.desde is None or f[c] >= self.desde)
                and (self.hasta is None or f[c] < self.hasta)
            ]
        total = len(filas)
        if self.fin is not None:
            filas = filas[self.inicio:self.fin + 1]
        return SimpleNamespace(data=filas, count=total if self.contar else None)


class FakeDb:
    def __init__(self, tablas, usuarios=()):
        self.tablas = tablas
        self.auth = SimpleNamespace(admin=SimpleNamespace(
            list_users=lambda page=1, per_page=200: list(usuarios) if page == 1 else [],
        ))

    def table(self, nombre):
        if nombre not in self.tablas:
            raise RuntimeError(f"tabla {nombre} no existe")
        return FakeQuery(self.tablas[nombre])


@pytest.fixture
def cliente(monkeypatch):
    monkeypatch.setattr(panel, "_ahora", lambda: AHORA)
    app = FastAPI()
    app.include_router(panel.router)
    app.dependency_overrides[panel.admin_requerido] = lambda: {"role": "admin"}
    return SimpleNamespace(http=TestClient(app), app=app, monkeypatch=monkeypatch)


def _con_db(cliente, db):
    cliente.monkeypatch.setattr(panel, "cliente_admin", lambda: db)


def _total(serie, fecha):
    return next(p["total"] for p in serie if p["fecha"] == fecha)


def test_catorce_dias_terminan_hoy_en_hora_de_colombia(cliente):
    _con_db(cliente, FakeDb({"produccion_cultivo": []}))
    datos = cliente.http.get("/api/admin/panel/metricas").json()
    fechas = datos["actividad_14_dias"]["fechas"]
    assert len(fechas) == 14
    # En UTC ya es 25, pero en Colombia sigue siendo 24.
    assert fechas[-1] == "2026-10-24"
    assert fechas[0] == "2026-10-11"


def test_registro_de_las_8pm_cuenta_en_el_dia_local(cliente):
    tablas = {
        # 01:00 UTC del 25 = 20:00 del 24 en Colombia.
        "produccion_cultivo": [
            {"id": "1", "created_at": "2026-10-25T01:00:00+00:00", "cantidad_frutos": 4},
            {"id": "2", "created_at": "2026-10-24T15:00:00+00:00", "cantidad_frutos": 2},
        ],
    }
    _con_db(cliente, FakeDb(tablas))
    serie = cliente.http.get("/api/admin/panel/metricas").json()["actividad_14_dias"]["cosechas_registradas"]
    assert _total(serie, "2026-10-24") == 2
    assert all(p["fecha"] != "2026-10-25" for p in serie)  # no existe un "mañana" en la serie


def test_cosechas_suman_produccion_y_tabla_cosechas(cliente):
    tablas = {
        "produccion_cultivo": [{"id": "1", "created_at": "2026-10-20T15:00:00+00:00", "cantidad_frutos": 3}],
        "cosechas": [{"id": "9", "creado_en": "2026-10-20T16:00:00+00:00"}],
    }
    _con_db(cliente, FakeDb(tablas))
    serie = cliente.http.get("/api/admin/panel/metricas").json()["actividad_14_dias"]["cosechas_registradas"]
    assert _total(serie, "2026-10-20") == 2


def test_si_una_tabla_falla_la_serie_se_calcula_con_la_otra(cliente):
    tablas = {"produccion_cultivo": [{"id": "1", "created_at": "2026-10-20T15:00:00+00:00", "cantidad_frutos": 1}]}
    _con_db(cliente, FakeDb(tablas))  # no existe la tabla "cosechas"
    serie = cliente.http.get("/api/admin/panel/metricas").json()["actividad_14_dias"]["cosechas_registradas"]
    assert _total(serie, "2026-10-20") == 1


def test_serie_no_disponible_si_ninguna_tabla_sirve(cliente):
    _con_db(cliente, FakeDb({}))
    actividad = cliente.http.get("/api/admin/panel/metricas").json()["actividad_14_dias"]
    assert actividad["cosechas_registradas"] is None
    assert actividad["escaneos"] is None


def test_usuarios_nuevos_por_dia_local(cliente):
    usuarios = [
        SimpleNamespace(created_at="2026-10-25T01:00:00+00:00", email_confirmed_at="x"),
        SimpleNamespace(created_at="2026-10-24T14:00:00+00:00", email_confirmed_at=None),
        SimpleNamespace(created_at="2026-09-01T14:00:00+00:00", email_confirmed_at="x"),
    ]
    _con_db(cliente, FakeDb({}, usuarios))
    datos = cliente.http.get("/api/admin/panel/metricas").json()
    u = datos["usuarios"]
    assert (u["total"], u["confirmados"], u["sin_confirmar"]) == (3, 2, 1)
    assert _total(u["nuevos_por_dia"], "2026-10-24") == 2
    assert u["nuevos_7_dias"] == 2


def test_foro_devuelve_publicaciones(cliente):
    filas = [{"id": "1", "titulo": "Hola", "categoria": "Consejos", "contenido": "x",
              "autor_nombre": "Ana", "created_at": "2026-10-20T10:00:00+00:00"}]
    _con_db(cliente, FakeDb({"foro_publicaciones": filas}))
    r = cliente.http.get("/api/admin/panel/foro")
    assert r.status_code == 200
    assert r.json()["publicaciones"][0]["titulo"] == "Hola"


def test_sin_token_administrativo_responde_401():
    app = FastAPI()
    app.include_router(panel.router)
    http = TestClient(app)
    for ruta in ("/metricas", "/foro"):
        assert http.get(f"/api/admin/panel{ruta}").status_code == 401
    borrar = http.delete("/api/admin/panel/foro/00000000-0000-0000-0000-000000000000")
    assert borrar.status_code == 401
