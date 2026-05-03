#!/usr/bin/env python3
"""
Compatibility wrapper for the old import entrypoint.

The project now uses the HKUST company-level files as the only source:
  data/hkust_文件汇总/*.xlsx -> company_trade_flows
  company_trade_flows -> country_origin_trade_stats

Keeping this filename prevents old runbooks from accidentally re-importing
the previous pure country-pair data.
"""

from upload_company_trade_flows import main


if __name__ == "__main__":
    main()
