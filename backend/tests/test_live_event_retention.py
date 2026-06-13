from __future__ import annotations

from contextlib import contextmanager

from app.models import cleanup_repository, event_repository


class RecordingCursor:
    def __init__(self, rows=None, fail_on_execute=False):
        self.rows = rows or []
        self.fail_on_execute = fail_on_execute
        self.executed = []

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def execute(self, sql, params=None):
        if self.fail_on_execute:
            raise RuntimeError("database failed")
        self.executed.append((sql, params))

    def fetchall(self):
        return self.rows


class RecordingConnection:
    def __init__(self, cursor):
        self._cursor = cursor

    def cursor(self, *args, **kwargs):
        return self._cursor


@contextmanager
def fake_conn(cursor):
    yield RecordingConnection(cursor)


def normalized_sql(sql: str) -> str:
    return " ".join(sql.split())


def test_recent_events_are_limited_to_last_24_hours(monkeypatch):
    cursor = RecordingCursor()
    monkeypatch.setattr(event_repository, "get_conn", lambda: fake_conn(cursor))

    assert event_repository.get_recent_events(limit=25) == []

    sql, params = cursor.executed[0]
    compact_sql = normalized_sql(sql)
    assert "WHERE origin_time >= NOW() - INTERVAL '1 day'" in compact_sql
    assert "ORDER BY origin_time DESC" in compact_sql
    assert params == (25,)


def test_cleanup_archives_magnitude_four_plus_old_events_and_prunes_live_table(monkeypatch):
    cursor = RecordingCursor()
    cache_cleared = {"value": False}
    monkeypatch.setattr(cleanup_repository, "get_conn", lambda: fake_conn(cursor))
    monkeypatch.setattr(cleanup_repository, "clear_historic_cache", lambda: cache_cleared.update(value=True))

    cleanup_repository.cleanup_old_data()

    executed_sql = [normalized_sql(sql) for sql, _params in cursor.executed]
    archive_sql = executed_sql[1]
    delete_sql = executed_sql[2]

    assert "INSERT INTO historic_events" in archive_sql
    assert "SELECT source_id, source, fingerprint" in archive_sql
    assert "WHERE origin_time < NOW() - INTERVAL '1 day'" in archive_sql
    assert "AND magnitude >= 4.0" in archive_sql
    assert "ON CONFLICT (source_id) DO NOTHING" in archive_sql

    assert "DELETE FROM earthquake_events" in delete_sql
    assert "WHERE origin_time < NOW() - INTERVAL '1 day'" in delete_sql
    assert "90 days" not in delete_sql
    assert cache_cleared["value"] is True


def test_cleanup_does_not_clear_historic_cache_on_failure(monkeypatch):
    cursor = RecordingCursor(fail_on_execute=True)
    cache_cleared = {"value": False}
    monkeypatch.setattr(cleanup_repository, "get_conn", lambda: fake_conn(cursor))
    monkeypatch.setattr(cleanup_repository, "clear_historic_cache", lambda: cache_cleared.update(value=True))

    try:
        cleanup_repository.cleanup_old_data()
    except RuntimeError:
        pass

    assert cache_cleared["value"] is False
