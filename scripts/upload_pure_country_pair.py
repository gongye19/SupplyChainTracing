#!/usr/bin/env python3
"""
Compatibility wrapper for the old import entrypoint.

The project now imports compact dashboard aggregates plus country trade
aggregates through scripts/upload_company_trade_flows.py. That script prefers
the new pure_company_pair_usd_count.zip source when present and falls back to
the legacy HKUST XLSX directory.

Keeping this filename prevents old runbooks from accidentally re-importing
the previous pure country-pair data.
"""

from upload_company_trade_flows import main


if __name__ == "__main__":
    main()
