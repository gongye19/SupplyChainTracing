from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import text


@dataclass(frozen=True)
class TableSpec:
    name: str
    columns: list[str]
    create_sql: str
    indexes: list[tuple[str, str]]


TABLE_SPECS = [
    TableSpec(
        name="company_search_stats",
        columns=[
            "name",
            "brand_name",
            "country_code",
            "role",
            "total_trade_value",
            "trade_count",
            "import_trade_value",
            "export_trade_value",
        ],
        create_sql="""
            name TEXT NOT NULL,
            brand_name TEXT,
            country_code VARCHAR(3),
            role VARCHAR(10) NOT NULL,
            total_trade_value NUMERIC(24,2),
            trade_count INTEGER,
            import_trade_value NUMERIC(24,2),
            export_trade_value NUMERIC(24,2)
        """,
        indexes=[
            ("idx_css_name", "(name)"),
            ("idx_css_brand", "(brand_name)"),
            ("idx_css_country_role", "(country_code, role)"),
            ("idx_css_total_value", "(total_trade_value DESC)"),
            ("idx_css_trade_count", "(trade_count DESC)"),
        ],
    ),
    TableSpec(
        name="company_monthly_trade_stats",
        columns=["company_name", "country_code", "role", "year", "month", "sum_of_usd", "trade_count"],
        create_sql="""
            company_name TEXT NOT NULL,
            country_code VARCHAR(3),
            role VARCHAR(10) NOT NULL,
            year INTEGER NOT NULL,
            month INTEGER NOT NULL,
            sum_of_usd NUMERIC(24,2),
            trade_count INTEGER
        """,
        indexes=[
            ("idx_cmts_company_ym", "(company_name, year, month)"),
            ("idx_cmts_company_role_ym", "(company_name, role, year, month)"),
        ],
    ),
    TableSpec(
        name="company_hs_trade_stats",
        columns=[
            "company_name",
            "country_code",
            "role",
            "hs_code",
            "product_desc_zh",
            "product_desc_en",
            "sum_of_usd",
            "trade_count",
        ],
        create_sql="""
            company_name TEXT NOT NULL,
            country_code VARCHAR(3),
            role VARCHAR(10) NOT NULL,
            hs_code VARCHAR(6) NOT NULL,
            product_desc_zh TEXT,
            product_desc_en TEXT,
            sum_of_usd NUMERIC(24,2),
            trade_count INTEGER
        """,
        indexes=[
            ("idx_chts_company_hs", "(company_name, hs_code)"),
            ("idx_chts_hs_company", "(hs_code, company_name)"),
        ],
    ),
    TableSpec(
        name="company_counterparty_trade_stats",
        columns=[
            "company_name",
            "country_code",
            "role",
            "counterparty_name",
            "counterparty_country_code",
            "sum_of_usd",
            "trade_count",
        ],
        create_sql="""
            company_name TEXT NOT NULL,
            country_code VARCHAR(3),
            role VARCHAR(10) NOT NULL,
            counterparty_name TEXT NOT NULL,
            counterparty_country_code VARCHAR(3),
            sum_of_usd NUMERIC(24,2),
            trade_count INTEGER
        """,
        indexes=[
            ("idx_ccts_company_role", "(company_name, role)"),
            ("idx_ccts_company_value", "(company_name, role, sum_of_usd DESC)"),
        ],
    ),
    TableSpec(
        name="country_origin_trade_stats",
        columns=[
            "hs_code",
            "year",
            "month",
            "origin_country_code",
            "destination_country_code",
            "sum_of_usd",
            "trade_count",
            "product_desc_zh",
            "product_desc_en",
        ],
        create_sql="""
            hs_code                  VARCHAR(6)  NOT NULL,
            year                     INTEGER     NOT NULL,
            month                    INTEGER     NOT NULL,
            origin_country_code      VARCHAR(3)  NOT NULL,
            destination_country_code VARCHAR(3)  NOT NULL,
            sum_of_usd               NUMERIC(20,2),
            trade_count              INTEGER,
            product_desc_zh          TEXT,
            product_desc_en          TEXT,
            created_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        """,
        indexes=[
            ("idx_cots_hs", "(hs_code)"),
            ("idx_cots_ym", "(year, month)"),
            ("idx_cots_origin", "(origin_country_code)"),
            ("idx_cots_dest", "(destination_country_code)"),
            ("idx_cots_hs_ym", "(hs_code, year, month)"),
            ("idx_cots_dest_ym", "(destination_country_code, year, month)"),
            ("idx_cots_origin_ym", "(origin_country_code, year, month)"),
            ("uq_cots_pair", "(hs_code, year, month, origin_country_code, destination_country_code) UNIQUE"),
        ],
    ),
]

TABLE_COLUMNS = {spec.name: spec.columns for spec in TABLE_SPECS}
CURRENT_TABLES = [spec.name for spec in TABLE_SPECS]
LEGACY_TABLES = ["company_trade_flows", "country_monthly_trade_stats"]


def physical_name(table: str, suffix: str = "") -> str:
    return f"{table}{suffix}"


def index_name(base_name: str, suffix: str = "") -> str:
    if not suffix:
        return base_name
    clean_suffix = suffix.replace("__", "_").strip("_")
    return f"{base_name}_{clean_suffix}"[:63]


def create_tables(engine, *, suffix: str = "") -> None:
    with engine.begin() as conn:
        for spec in TABLE_SPECS:
            name = physical_name(spec.name, suffix)
            conn.execute(text(f"DROP TABLE IF EXISTS {name} CASCADE"))
            conn.execute(text(f"CREATE TABLE {name} ({spec.create_sql})"))


def create_indexes(engine, *, suffix: str = "") -> None:
    with engine.begin() as conn:
        for spec in TABLE_SPECS:
            table = physical_name(spec.name, suffix)
            for base_name, columns in spec.indexes:
                unique = False
                column_expr = columns
                if columns.endswith(" UNIQUE"):
                    unique = True
                    column_expr = columns.removesuffix(" UNIQUE")
                unique_sql = "UNIQUE " if unique else ""
                conn.execute(text(f"CREATE {unique_sql}INDEX {index_name(base_name, suffix)} ON {table} {column_expr}"))


def drop_tables(engine, *, suffix: str = "") -> None:
    with engine.begin() as conn:
        for table in CURRENT_TABLES:
            conn.execute(text(f"DROP TABLE IF EXISTS {physical_name(table, suffix)} CASCADE"))


def swap_staging_tables(engine, *, staging_suffix: str, backup_suffix: str = "__old") -> None:
    with engine.begin() as conn:
        for table in CURRENT_TABLES:
            conn.execute(text(f"DROP TABLE IF EXISTS {physical_name(table, backup_suffix)} CASCADE"))

        for table in LEGACY_TABLES:
            conn.execute(text(f"DROP TABLE IF EXISTS {table} CASCADE"))

        for table in CURRENT_TABLES:
            staging = physical_name(table, staging_suffix)
            backup = physical_name(table, backup_suffix)
            exists = conn.execute(
                text(
                    """
                    SELECT EXISTS (
                        SELECT 1
                        FROM information_schema.tables
                        WHERE table_schema = 'public' AND table_name = :table_name
                    )
                    """
                ),
                {"table_name": table},
            ).scalar()
            if exists:
                conn.execute(text(f"ALTER TABLE {table} RENAME TO {backup}"))
            conn.execute(text(f"ALTER TABLE {staging} RENAME TO {table}"))

        for table in CURRENT_TABLES:
            conn.execute(text(f"DROP TABLE IF EXISTS {physical_name(table, backup_suffix)} CASCADE"))
