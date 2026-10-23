"""Pruebas del acceso administrativo solo con correo. Ejecutar con:  pytest"""
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.routers import admin as admin_mod

ADMIN = "admin@floraviva.test"


class FakeQuery:
    def __init__(self, db, nombre):
        self.db, self.nombre = db, nombre

    def select(self, *_):
        return self

    def eq(self, *_):
        return self

    def limit(self, *_):
        return self

    def upsert(self, fila, **_):
        self.db.retos[self.nombre] = fila
        return self

    def update(self, *_):
        return self

    def execute(self):
        fila = self.db.retos.get(self.nombre)
        return SimpleNamespace(data=[fila] if fila and self.db.devolver_reto else [])


class FakeRpc:
    def __init__(self, valido):
        self.valido = valido

    def execute(self):
        return SimpleNamespace(data=[{"valid": self.valido, "attempts": 1}])


class FakeDb:
    def __init__(self, existe=True, valido=True):
        self.retos, self.existe, self.valido = {}, existe, valido
        self.devolver_reto = False
        self.creados = []
        self.auth = SimpleNamespace(admin=SimpleNamespace(
            list_users=lambda page=1, per_page=200: [SimpleNamespace(id="u1", email=ADMIN)] if self.existe else [],
            create_user=self._crear,
        ))

    def _crear(self, datos):
        self.creados.append(datos)
        return SimpleNamespace(user=SimpleNamespace(id="u-nuevo", email=datos["email"]))

    def table(self, nombre):
        return FakeQuery(self, nombre)

    def rpc(self, *_):
        return FakeRpc(self.valido)


@pytest.fixture
def entorno(monkeypatch):
    cfg = SimpleNamespace(
        floraviva_admin_email=ADMIN, admin_otp_secret="s" * 40, admin_session_secret="t" * 40,
        supabase_secret_key="k", admin_session_ttl_minutes=30,
    )
    enviados = []

    async def falso_envio(email, codigo):
        enviados.append((email, codigo))

    monkeypatch.setattr(admin_mod, "obtener_configuracion", lambda: cfg)
    monkeypatch.setattr(admin_mod, "enviar_codigo_admin", falso_envio)
    app = FastAPI()
    app.include_router(admin_mod.router)
    return SimpleNamespace(cliente=TestClient(app), enviados=enviados, monkeypatch=monkeypatch)


def _con_db(entorno, db):
    entorno.monkeypatch.setattr(admin_mod, "cliente_admin", lambda: db)


def test_correo_admin_recibe_codigo(entorno):
    _con_db(entorno, FakeDb())
    r = entorno.cliente.post("/api/admin/acceso/solicitar", json={"email": ADMIN.upper()})
    assert r.status_code == 200
    assert len(entorno.enviados) == 1
    assert entorno.enviados[0][0] == ADMIN
    assert len(entorno.enviados[0][1]) == 6


def test_correo_no_admin_no_recibe_nada_y_no_revela_nada(entorno):
    _con_db(entorno, FakeDb())
    r = entorno.cliente.post("/api/admin/acceso/solicitar", json={"email": "intruso@x.com"})
    assert r.status_code == 200
    assert entorno.enviados == []


def test_crea_la_cuenta_admin_si_no_existe(entorno):
    db = FakeDb(existe=False)
    _con_db(entorno, db)
    r = entorno.cliente.post("/api/admin/acceso/solicitar", json={"email": ADMIN})
    assert r.status_code == 200
    assert db.creados and db.creados[0]["email_confirm"] is True


def test_limite_de_un_codigo_por_minuto(entorno):
    from datetime import datetime, timezone
    db = FakeDb()
    db.retos["admin_login_challenges"] = {"requested_at": datetime.now(timezone.utc).isoformat()}
    db.devolver_reto = True
    _con_db(entorno, db)
    r = entorno.cliente.post("/api/admin/acceso/solicitar", json={"email": ADMIN})
    assert r.status_code == 429
    assert entorno.enviados == []


def test_codigo_valido_entrega_token_admin(entorno):
    _con_db(entorno, FakeDb(valido=True))
    r = entorno.cliente.post("/api/admin/acceso/verificar", json={"email": ADMIN, "codigo": "123456"})
    assert r.status_code == 200
    claims = admin_mod.verificar_token_admin(r.json()["token_admin"])
    assert claims["role"] == "admin" and claims["email"] == ADMIN


def test_codigo_invalido_da_401(entorno):
    _con_db(entorno, FakeDb(valido=False))
    r = entorno.cliente.post("/api/admin/acceso/verificar", json={"email": ADMIN, "codigo": "000000"})
    assert r.status_code == 401


def test_correo_no_admin_no_puede_verificar(entorno):
    _con_db(entorno, FakeDb(valido=True))
    r = entorno.cliente.post("/api/admin/acceso/verificar", json={"email": "intruso@x.com", "codigo": "123456"})
    assert r.status_code == 401


def test_codigo_mal_formado_se_rechaza(entorno):
    _con_db(entorno, FakeDb())
    r = entorno.cliente.post("/api/admin/acceso/verificar", json={"email": ADMIN, "codigo": "12ab"})
    assert r.status_code == 422
