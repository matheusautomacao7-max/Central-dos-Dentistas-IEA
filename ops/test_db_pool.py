import importlib
import os
import sys
import types
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "app"))


class FakeRawConnection:
    def commit(self):
        pass

    def rollback(self):
        pass

    def close(self):
        raise AssertionError("Conexão do pool não deve ser fechada fisicamente")


class FakePool:
    instances = []

    def __init__(self, conninfo, **kwargs):
        self.conninfo = conninfo
        self.kwargs = kwargs
        self.borrowed = []
        self.returned = []
        self.closed = False
        self.__class__.instances.append(self)

    @staticmethod
    def check_connection(connection):
        return None

    def getconn(self, timeout=None):
        connection = FakeRawConnection()
        self.borrowed.append(connection)
        return connection

    def putconn(self, connection):
        self.returned.append(connection)

    def close(self):
        self.closed = True

    def get_stats(self):
        return {"pool_size": 2, "pool_available": 2}


psycopg = types.ModuleType("psycopg")
psycopg_sql = types.ModuleType("psycopg.sql")
psycopg_errors = types.ModuleType("psycopg.errors")
psycopg.Error = RuntimeError
psycopg.connect = lambda *_args, **_kwargs: (_ for _ in ()).throw(
    AssertionError("psycopg.connect não deve ser chamado diretamente")
)
psycopg.sql = psycopg_sql
psycopg_errors.IntegrityError = RuntimeError
psycopg_pool = types.ModuleType("psycopg_pool")
psycopg_pool.ConnectionPool = FakePool
sys.modules.update({
    "psycopg": psycopg,
    "psycopg.sql": psycopg_sql,
    "psycopg.errors": psycopg_errors,
    "psycopg_pool": psycopg_pool,
})

os.environ["DB_POOL_MIN"] = "2"
os.environ["DB_POOL_MAX"] = "8"
os.environ["DB_POOL_TIMEOUT_SECONDS"] = "4"
db_backend = importlib.import_module("db_backend")
db_backend.configure("postgresql://crm@db/crm")

first = db_backend.PostgresConnection()
second = db_backend.PostgresConnection()
pool = FakePool.instances[-1]
assert pool.kwargs["min_size"] == 2
assert pool.kwargs["max_size"] == 8
assert pool.kwargs["timeout"] == 4
assert pool.kwargs["open"] is True
assert len(pool.borrowed) == 2
first.close()
second.close()
assert pool.returned == pool.borrowed
assert db_backend.pool_stats()["pool_size"] == 2

print("db-pool-tests-ok")
