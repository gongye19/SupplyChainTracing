from __future__ import annotations

from sqlalchemy.exc import ProgrammingError


def is_missing_table_error(error: Exception) -> bool:
    """判断是否为表不存在错误（兼容 psycopg2 + SQLAlchemy 包装）。"""
    message = str(error).lower()
    if "undefinedtable" in message:
        return True
    if "relation" in message and "does not exist" in message:
        return True
    if isinstance(error, ProgrammingError):
        orig = getattr(error, "orig", None)
        if orig and "undefinedtable" in str(orig).lower():
            return True
    return False


def rows_to_dicts(result, rows):
    """将 SQLAlchemy Row 列表转换成 dict 列表。"""
    output = []
    for row in rows:
        if hasattr(row, "_mapping"):
            output.append(dict(row._mapping))
        elif hasattr(row, "_asdict"):
            output.append(row._asdict())
        else:
            cols = result.keys() if hasattr(result, "keys") else []
            output.append({col: row[i] for i, col in enumerate(cols)})
    return output

