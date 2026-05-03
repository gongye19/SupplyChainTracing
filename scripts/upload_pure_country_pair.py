#!/usr/bin/env python3
"""
Compatibility wrapper for the old import entrypoint.

The project now uses the HKUST company-level files as the only source and
imports compact dashboard aggregates plus country trade aggregates.

Keeping this filename prevents old runbooks from accidentally re-importing
the previous pure country-pair data.
"""

from upload_company_trade_flows import main


if __name__ == "__main__":
    main()
