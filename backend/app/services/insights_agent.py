from __future__ import annotations

from ..schemas import InsightAgentPreviewRequest


AGENT_NAME = "supply-chain-insight-agent"
SUPPORTED_SOURCES = ["company_trade_aggregates", "country_trade_flows", "brand_news_events"]


def status_payload() -> dict:
    return {
        "enabled": False,
        "name": AGENT_NAME,
        "supported_sources": SUPPORTED_SOURCES,
        "message": "Insight agent slot is reserved. Trade/news reasoning is not enabled yet.",
    }


def preview_payload(request: InsightAgentPreviewRequest) -> dict:
    return {
        "enabled": False,
        "message": "Insight agent is reserved for a future trade-data and news-event insight workflow.",
        "requested_brands": request.brands,
    }
