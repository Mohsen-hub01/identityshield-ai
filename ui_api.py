"""Read-only data endpoints used by the IdentityShield AI frontend.

These routes expose data that already exists in the repository (synthetic
profiles, synthetic access events, model reports and security playbooks).
They do not change the detection workflow, the ML model or the review rules.
"""

from __future__ import annotations

import json
import os
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, Field

from auth_security import decode_access_token


BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
REPORTS_DIR = BASE_DIR / "reports"
PLAYBOOK_DIR = BASE_DIR / "knowledge" / "security_playbooks"
AUDIT_PATH = Path(
    os.getenv(
        "IDENTITYSHIELD_AUDIT_PATH",
        str(REPORTS_DIR / "human_review_audit.jsonl"),
    )
)

router = APIRouter(prefix="/api/ui", tags=["ui-experience"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/token")


# ============================================================
# AUTHENTICATION
# ============================================================

def get_current_user(token: str = Depends(oauth2_scheme)) -> dict[str, str]:
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(
            status_code=401,
            detail="Token invalide ou expiré",
            headers={"WWW-Authenticate": "Bearer"},
        )

    username = payload.get("sub")
    role = payload.get("role")
    if not username or not role:
        raise HTTPException(status_code=401, detail="Token incomplet")

    return {"username": username, "role": role}


def require_roles(*allowed_roles: str):
    def role_checker(
        current_user: dict[str, str] = Depends(get_current_user),
    ) -> dict[str, str]:
        if current_user["role"] not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail="Accès interdit pour ce rôle",
            )
        return current_user

    return role_checker


# ============================================================
# DATA LOADING
# ============================================================

@lru_cache(maxsize=1)
def _profiles_frame() -> pd.DataFrame:
    frame = pd.read_csv(DATA_DIR / "user_profiles.csv")
    frame["user_id"] = frame["user_id"].astype(str).str.strip()
    frame["home_country"] = frame["home_country"].astype(str).str.strip()
    frame["usual_hour"] = frame["usual_hour"].astype(int)
    return frame


@lru_cache(maxsize=1)
def _events_frame() -> pd.DataFrame:
    """Load synthetic events and add the same deterministic rule score.

    This mirrors the rule engine in main.py without importing the API module,
    which keeps this read-only layer independent from the workflow runtime.
    """
    events = pd.read_csv(DATA_DIR / "access_events.csv")
    events["user_id"] = events["user_id"].astype(str).str.strip()
    events["country"] = events["country"].astype(str).str.strip()
    events["event_order"] = np.arange(len(events))

    merged = events.merge(
        _profiles_frame(),
        on="user_id",
        how="left",
        validate="many_to_one",
    )
    merged["home_country"] = merged["home_country"].fillna("")
    merged["usual_hour"] = merged["usual_hour"].fillna(merged["hour"]).astype(int)

    country_unusual = (merged["country"] != merged["home_country"]).astype(int)
    hour_unusual = (
        (merged["hour"] - merged["usual_hour"]).abs() >= 6
    ).astype(int)
    failed_score = np.where(
        merged["failed_attempts"] >= 3,
        np.minimum(merged["failed_attempts"] * 10, 30),
        0,
    )

    score = (
        country_unusual * 50
        + hour_unusual * 20
        + failed_score
        + merged["impossible_travel"].astype(int) * 50
    )
    merged["rule_country_unusual"] = country_unusual
    merged["rule_hour_unusual"] = hour_unusual
    merged["risk_score"] = np.minimum(score, 100).astype(int)
    merged["risk_level"] = np.select(
        [merged["risk_score"] >= 70, merged["risk_score"] >= 30],
        ["HIGH", "MEDIUM"],
        default="LOW",
    )
    return merged


@lru_cache(maxsize=1)
def _final_metrics() -> dict[str, Any]:
    path = REPORTS_DIR / "final_evaluation" / "final_test_metrics.json"
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def _selected_config() -> dict[str, Any]:
    path = REPORTS_DIR / "threshold_selection" / "selected_configuration.json"
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def _threshold_validation() -> list[dict[str, Any]]:
    path = REPORTS_DIR / "threshold_selection" / (
        "logisticregression_thresholds_validation.csv"
    )
    if not path.exists():
        return []
    frame = pd.read_csv(path)
    return [
        {key: _clean_number(value) for key, value in row.items()}
        for row in frame.to_dict(orient="records")
    ]


@lru_cache(maxsize=1)
def _playbook_documents() -> list[dict[str, Any]]:
    documents: list[dict[str, Any]] = []
    if not PLAYBOOK_DIR.exists():
        return documents

    for path in sorted(PLAYBOOK_DIR.glob("*.md")):
        content = path.read_text(encoding="utf-8").strip()
        lines = content.splitlines()
        title = path.stem.replace("_", " ").title()
        for line in lines:
            if line.startswith("# "):
                title = line[2:].strip()
                break

        sections = [
            line[3:].strip()
            for line in lines
            if line.startswith("## ")
        ]

        documents.append({
            "id": path.stem,
            "title": title,
            "filename": path.name,
            "source": f"knowledge/security_playbooks/{path.name}",
            "sections": sections,
            "content": content,
            "word_count": len(content.split()),
        })

    return documents


# ============================================================
# HELPERS
# ============================================================

def _clean_number(value: Any) -> Any:
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        return round(float(value), 6)
    if isinstance(value, float):
        return round(value, 6)
    return value


def _records(frame: pd.DataFrame) -> list[dict[str, Any]]:
    return [
        {key: _clean_number(value) for key, value in row.items()}
        for row in frame.to_dict(orient="records")
    ]


def _risk_distribution(events: pd.DataFrame) -> list[dict[str, Any]]:
    total = max(len(events), 1)
    counts = events["risk_level"].value_counts().to_dict()
    return [
        {
            "level": level,
            "count": int(counts.get(level, 0)),
            "share": round(counts.get(level, 0) / total, 4),
        }
        for level in ("LOW", "MEDIUM", "HIGH")
    ]


def _identity_summaries(events: pd.DataFrame) -> list[dict[str, Any]]:
    profiles = {
        row["user_id"]: row
        for row in _profiles_frame().to_dict(orient="records")
    }
    summaries: list[dict[str, Any]] = []

    for user_id, group in events.groupby("user_id", sort=False):
        ordered = group.sort_values("event_order")
        last = ordered.iloc[-1]
        recent = ordered.tail(12)
        high_risk = int((ordered["risk_level"] == "HIGH").sum())
        medium_risk = int((ordered["risk_level"] == "MEDIUM").sum())
        recent_high_risk = int((recent["risk_level"] == "HIGH").sum())
        recent_medium_risk = int((recent["risk_level"] == "MEDIUM").sum())
        recent_max_risk = int(recent["risk_score"].max())

        # Identity posture is based on a recent window rather than any single
        # historical HIGH event, which would flag every identity in this dataset.
        if recent_high_risk >= 3:
            status = "critical"
        elif recent_high_risk >= 1 or recent_medium_risk >= 2:
            status = "elevated"
        else:
            status = "normal"

        profile = profiles.get(user_id, {})
        country_counts = ordered["country"].value_counts().head(3)

        summaries.append({
            "user_id": user_id,
            "home_country": str(profile.get("home_country", last["home_country"])),
            "usual_hour": int(profile.get("usual_hour", last["usual_hour"])),
            "event_count": int(len(group)),
            "suspicious_count": int(group["label"].fillna(0).sum()),
            "high_risk_count": high_risk,
            "medium_risk_count": medium_risk,
            "recent_high_risk_count": recent_high_risk,
            "recent_medium_risk_count": recent_medium_risk,
            "recent_max_risk_score": recent_max_risk,
            "risk_score": recent_max_risk,
            "new_device_count": int(group["new_device"].sum()),
            "impossible_travel_count": int(group["impossible_travel"].sum()),
            "average_failed_attempts": round(
                float(group["failed_attempts"].mean()), 2
            ),
            "historical_max_risk_score": int(group["risk_score"].max()),
            "average_risk_score": round(float(group["risk_score"].mean()), 2),
            "status": status,
            "last_event_id": str(last["event_id"]),
            "last_country": str(last["country"]),
            "last_hour": int(last["hour"]),
            "last_risk_level": str(last["risk_level"]),
            "last_dataset_label": (
                "suspicious" if int(last.get("label", 0)) == 1 else "benign"
            ),
            "top_countries": [
                {"country": str(country), "count": int(count)}
                for country, count in country_counts.items()
            ],
            "risk_series": [
                {
                    "event_id": str(row["event_id"]),
                    "risk_score": int(row["risk_score"]),
                }
                for _, row in group.tail(60).iterrows()
            ],
        })

    summaries.sort(
        key=lambda item: (
            item["risk_score"],
            item["recent_high_risk_count"],
            item["suspicious_count"],
            item["event_count"],
        ),
        reverse=True,
    )
    return summaries


def _event_payload(row: pd.Series) -> dict[str, Any]:
    return {
        "event_id": str(row["event_id"]),
        "user_id": str(row["user_id"]),
        "country": str(row["country"]),
        "home_country": str(row["home_country"]),
        "usual_hour": int(row["usual_hour"]),
        "hour": int(row["hour"]),
        "failed_attempts": int(row["failed_attempts"]),
        "new_device": int(row["new_device"]),
        "ip_risk_score": round(float(row["ip_risk_score"]), 2),
        "impossible_travel": int(row["impossible_travel"]),
        "risk_score": int(row["risk_score"]),
        "risk_level": str(row["risk_level"]),
        "dataset_label": "suspicious" if int(row.get("label", 0)) == 1 else "benign",
        "country_unusual": int(row["rule_country_unusual"]),
        "hour_unusual": int(row["rule_hour_unusual"]),
    }


def _dataset_note() -> dict[str, Any]:
    return {
        "synthetic": True,
        "source": "data/access_events.csv",
        "profiles": "data/user_profiles.csv",
        "note": (
            "Synthetic research dataset. Risk levels shown here are derived "
            "with the project rule engine and are investigation signals, "
            "not proof of compromise."
        ),
    }


# ============================================================
# OVERVIEW
# ============================================================

@router.get("/overview")
def overview(
    _: dict[str, str] = Depends(get_current_user),
) -> dict[str, Any]:
    events = _events_frame()
    identities = _identity_summaries(events)

    total = max(len(events), 1)
    risk_distribution = _risk_distribution(events)
    high_risk = int((events["risk_level"] == "HIGH").sum())
    medium_risk = int((events["risk_level"] == "MEDIUM").sum())
    low_risk = int((events["risk_level"] == "LOW").sum())

    hourly = []
    for hour in range(24):
        subset = events[events["hour"] == hour]
        hourly.append({
            "hour": hour,
            "events": int(len(subset)),
            "suspicious": int(subset["label"].fillna(0).sum()),
            "high_risk": int((subset["risk_level"] == "HIGH").sum()),
        })

    country_frame = (
        events.groupby("country")
        .agg(
            events=("event_id", "count"),
            suspicious=("label", "sum"),
            high_risk=("risk_level", lambda values: int((values == "HIGH").sum())),
            average_ip_risk=("ip_risk_score", "mean"),
        )
        .reset_index()
        .sort_values("events", ascending=False)
        .head(10)
    )
    country_frame["average_ip_risk"] = country_frame["average_ip_risk"].round(1)

    priority = events[events["risk_level"] == "HIGH"].sort_values(
        ["risk_score", "impossible_travel", "failed_attempts", "event_order"],
        ascending=False,
    ).head(7)

    latest = events.sort_values("event_order", ascending=False).head(6)

    critical_identities = sum(1 for item in identities if item["status"] == "critical")
    elevated_identities = sum(1 for item in identities if item["status"] == "elevated")
    foreign_share = float(events["rule_country_unusual"].mean())
    impossible_share = float(events["impossible_travel"].mean())
    failed_share = float((events["failed_attempts"] >= 3).mean())
    low_risk_share = low_risk / total

    metrics = _final_metrics()
    selected = _selected_config()

    insights = [
        {
            "tone": "critical" if critical_identities else "success",
            "title": f"{critical_identities} identities have HIGH-risk signals",
            "detail": (
                f"{elevated_identities} additional identities show MEDIUM-risk "
                "signals in the synthetic dataset."
            ),
        },
        {
            "tone": "warning",
            "title": f"{foreign_share:.1%} of events are outside the home country",
            "detail": (
                "Geographic deviation is a rule signal, not evidence of an attack."
            ),
        },
        {
            "tone": "info",
            "title": f"{impossible_share:.1%} of events carry an impossible-travel flag",
            "detail": (
                f"{failed_share:.1%} of events also contain at least three failed attempts."
            ),
        },
        {
            "tone": "info",
            "title": "Model recall is the key review constraint",
            "detail": (
                f"{metrics.get('model', 'LogisticRegression')} at threshold "
                f"{metrics.get('threshold', selected.get('selected_threshold', 0.6))} "
                f"reaches {metrics.get('recall', 0):.1%} recall on the held-out synthetic test set."
            ),
        },
    ]

    return {
        "generated_at": pd.Timestamp.utcnow().isoformat(),
        "dataset": _dataset_note(),
        "counts": {
            "identities": int(events["user_id"].nunique()),
            "events": int(total),
            "suspicious_events": int(events["label"].fillna(0).sum()),
            "high_risk_events": high_risk,
            "medium_risk_events": medium_risk,
            "low_risk_events": low_risk,
            "critical_identities": critical_identities,
            "elevated_identities": elevated_identities,
        },
        "risk_distribution": risk_distribution,
        "posture": {
            "low_risk_share": round(low_risk_share, 4),
            "label": (
                "Elevated exposure"
                if low_risk_share < 0.6
                else "Contained exposure"
            ),
            "note": "Share of synthetic events classified LOW by the rule engine.",
        },
        "hourly_activity": hourly,
        "country_activity": _records(country_frame),
        "priority_incidents": [_event_payload(row) for _, row in priority.iterrows()],
        "latest_events": [_event_payload(row) for _, row in latest.iterrows()],
        "top_identities": identities[:6],
        "insights": insights,
        "model": {
            "name": metrics.get("model", "LogisticRegression"),
            "threshold": metrics.get("threshold", selected.get("selected_threshold")),
            "accuracy": metrics.get("accuracy"),
            "precision": metrics.get("precision"),
            "recall": metrics.get("recall"),
            "f1": metrics.get("f1"),
            "average_precision": metrics.get("average_precision"),
            "test_size": metrics.get("test_size"),
            "confusion": {
                "tn": metrics.get("TN"),
                "fp": metrics.get("FP"),
                "fn": metrics.get("FN"),
                "tp": metrics.get("TP"),
            },
        },
    }


# ============================================================
# IDENTITIES
# ============================================================

@router.get("/identities")
def identities(
    search: str = Query(default="", max_length=100),
    status: str = Query(default="all", pattern="^(all|normal|elevated|critical)$"),
    _: dict[str, str] = Depends(get_current_user),
) -> dict[str, Any]:
    events = _events_frame()
    items = _identity_summaries(events)

    if search.strip():
        needle = search.strip().casefold()
        items = [
            item for item in items
            if needle in item["user_id"].casefold()
            or needle in item["home_country"].casefold()
            or any(needle in country["country"].casefold() for country in item["top_countries"])
        ]

    if status != "all":
        items = [item for item in items if item["status"] == status]

    return {
        "count": len(items),
        "dataset": _dataset_note(),
        "identities": items,
    }


@router.get("/identities/{user_id}")
def identity_detail(
    user_id: str,
    _: dict[str, str] = Depends(get_current_user),
) -> dict[str, Any]:
    events = _events_frame()
    group = events[events["user_id"] == user_id.strip()]

    if group.empty:
        raise HTTPException(status_code=404, detail="Identité introuvable.")

    summary = next(
        item for item in _identity_summaries(events)
        if item["user_id"] == user_id.strip()
    )
    recent = group.sort_values("event_order", ascending=False).head(14)

    return {
        "identity": summary,
        "dataset": _dataset_note(),
        "recent_events": [_event_payload(row) for _, row in recent.iterrows()],
        "risk_series": summary["risk_series"],
    }


# ============================================================
# EVENTS
# ============================================================

@router.get("/events")
def events(
    risk_level: str = Query(default="all", pattern="^(all|LOW|MEDIUM|HIGH)$"),
    user_id: str = Query(default="", max_length=100),
    country: str = Query(default="", max_length=100),
    search: str = Query(default="", max_length=100),
    suspicious_only: bool = False,
    order: str = Query(default="risk", pattern="^(risk|recent)$"),
    limit: int = Query(default=50, ge=1, le=250),
    offset: int = Query(default=0, ge=0),
    _: dict[str, str] = Depends(get_current_user),
) -> dict[str, Any]:
    frame = _events_frame()

    if risk_level != "all":
        frame = frame[frame["risk_level"] == risk_level]
    if user_id.strip():
        frame = frame[frame["user_id"] == user_id.strip()]
    if country.strip():
        frame = frame[
            frame["country"].str.casefold() == country.strip().casefold()
        ]
    if suspicious_only:
        frame = frame[frame["label"].fillna(0) == 1]
    if search.strip():
        needle = search.strip().casefold()
        mask = (
            frame["event_id"].str.casefold().str.contains(needle, regex=False)
            | frame["user_id"].str.casefold().str.contains(needle, regex=False)
            | frame["country"].str.casefold().str.contains(needle, regex=False)
        )
        frame = frame[mask]

    total = len(frame)
    if order == "recent":
        frame = frame.sort_values("event_order", ascending=False)
    else:
        frame = frame.sort_values(
            ["risk_score", "impossible_travel", "failed_attempts", "event_order"],
            ascending=False,
        )

    page = frame.iloc[offset:offset + limit]
    return {
        "count": total,
        "limit": limit,
        "offset": offset,
        "events": [_event_payload(row) for _, row in page.iterrows()],
        "dataset": _dataset_note(),
    }


# ============================================================
# THREAT GRAPH
# ============================================================

@router.get("/threat-graph")
def threat_graph(
    _: dict[str, str] = Depends(get_current_user),
) -> dict[str, Any]:
    events = _events_frame()
    identities = _identity_summaries(events)

    nodes: list[dict[str, Any]] = [
        {
            "id": f"identity:{item['user_id']}",
            "label": item["user_id"],
            "type": "identity",
            "risk_score": item["risk_score"],
            "risk_level": (
                "HIGH" if item["status"] == "critical"
                else "MEDIUM" if item["status"] == "elevated"
                else "LOW"
            ),
            "event_count": item["event_count"],
            "home_country": item["home_country"],
        }
        for item in identities
    ]

    country_frame = (
        events.groupby("country")
        .agg(
            events=("event_id", "count"),
            suspicious=("label", "sum"),
            max_risk=("risk_score", "max"),
        )
        .reset_index()
        .sort_values("events", ascending=False)
    )

    nodes.extend([
        {
            "id": f"country:{row['country']}",
            "label": str(row["country"]),
            "type": "country",
            "risk_score": int(row["max_risk"]),
            "risk_level": (
                "HIGH" if row["max_risk"] >= 70
                else "MEDIUM" if row["max_risk"] >= 30
                else "LOW"
            ),
            "event_count": int(row["events"]),
            "home_country": None,
        }
        for _, row in country_frame.iterrows()
    ])

    pairs = (
        events.groupby(["user_id", "country"])
        .agg(
            events=("event_id", "count"),
            suspicious=("label", "sum"),
            high_risk=("risk_level", lambda values: int((values == "HIGH").sum())),
            max_risk=("risk_score", "max"),
        )
        .reset_index()
    )

    links: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    for user_id, group in pairs.groupby("user_id"):
        top = group.sort_values(
            ["suspicious", "events", "max_risk"],
            ascending=False,
        ).head(4)

        for _, row in top.iterrows():
            key = (str(user_id), str(row["country"]))
            if key in seen:
                continue
            seen.add(key)
            links.append({
                "source": f"identity:{user_id}",
                "target": f"country:{row['country']}",
                "events": int(row["events"]),
                "suspicious": int(row["suspicious"]),
                "high_risk": int(row["high_risk"]),
                "max_risk": int(row["max_risk"]),
            })

    return {
        "nodes": nodes,
        "links": links,
        "dataset": _dataset_note(),
        "note": (
            "Edges represent synthetic authentication relationships between "
            "identities and countries. They do not represent confirmed attacks."
        ),
    }


# ============================================================
# ANALYTICS
# ============================================================

@router.get("/analytics")
def analytics(
    _: dict[str, str] = Depends(get_current_user),
) -> dict[str, Any]:
    events = _events_frame()

    hourly = []
    for hour in range(24):
        subset = events[events["hour"] == hour]
        hourly.append({
            "hour": hour,
            "events": int(len(subset)),
            "suspicious": int(subset["label"].fillna(0).sum()),
        })

    country_frame = (
        events.groupby("country")
        .agg(
            events=("event_id", "count"),
            suspicious=("label", "sum"),
            high_risk=("risk_level", lambda values: int((values == "HIGH").sum())),
        )
        .reset_index()
        .sort_values("events", ascending=False)
        .head(12)
    )

    bucket_labels = ["0", "1-2", "3-5", "6-10", "11+"]
    failed_buckets = [
        int(((events["failed_attempts"] == 0)).sum()),
        int(((events["failed_attempts"] >= 1) & (events["failed_attempts"] <= 2)).sum()),
        int(((events["failed_attempts"] >= 3) & (events["failed_attempts"] <= 5)).sum()),
        int(((events["failed_attempts"] >= 6) & (events["failed_attempts"] <= 10)).sum()),
        int((events["failed_attempts"] > 10).sum()),
    ]

    buckets = min(20, max(4, len(events) // 100))
    chunk = int(np.ceil(len(events) / buckets))
    trend = []
    for index in range(buckets):
        subset = events.iloc[index * chunk:(index + 1) * chunk]
        if subset.empty:
            continue
        trend.append({
            "sequence": f"{(index * chunk + 1):,}-{min((index + 1) * chunk, len(events)):,}",
            "suspicious_share": round(float(subset["label"].fillna(0).mean()), 4),
            "high_risk_share": round(
                float((subset["risk_level"] == "HIGH").mean()), 4
            ),
            "events": int(len(subset)),
        })

    metrics = _final_metrics()
    selected = _selected_config()

    return {
        "generated_at": pd.Timestamp.utcnow().isoformat(),
        "dataset": _dataset_note(),
        "risk_distribution": _risk_distribution(events),
        "hourly_activity": hourly,
        "country_activity": _records(country_frame),
        "failed_attempt_distribution": [
            {"bucket": label, "events": count}
            for label, count in zip(bucket_labels, failed_buckets)
        ],
        "signals": {
            "new_device_share": round(float(events["new_device"].mean()), 4),
            "impossible_travel_share": round(
                float(events["impossible_travel"].mean()), 4
            ),
            "foreign_country_share": round(
                float(events["rule_country_unusual"].mean()), 4
            ),
            "unusual_hour_share": round(
                float(events["rule_hour_unusual"].mean()), 4
            ),
            "average_ip_risk": round(float(events["ip_risk_score"].mean()), 2),
        },
        "sequence_trend": trend,
        "model": {
            "selected": selected,
            "final_metrics": metrics,
            "threshold_validation": _threshold_validation(),
        },
    }


# ============================================================
# PLAYBOOKS
# ============================================================

@router.get("/playbooks")
def playbooks(
    _: dict[str, str] = Depends(get_current_user),
) -> dict[str, Any]:
    documents = _playbook_documents()
    return {
        "count": len(documents),
        "documents": documents,
        "mode": "local-markdown",
    }


class PlaybookSearchRequest(BaseModel):
    query: str = Field(min_length=3, max_length=2000)
    top_k: int = Field(default=3, ge=1, le=5)


def _keyword_search(
    query: str,
    documents: list[dict[str, Any]],
    top_k: int,
) -> list[dict[str, Any]]:
    terms = [
        term for term in re.findall(r"[a-zA-ZÀ-ÿ0-9_]+", query.casefold())
        if len(term) > 2
    ]
    if not terms:
        return []

    matches: list[dict[str, Any]] = []
    for document in documents:
        sections: list[tuple[str, str]] = []
        current_title = "Document"
        current_lines: list[str] = []
        for line in document["content"].splitlines():
            if line.startswith("## "):
                if current_lines:
                    sections.append((current_title, "\n".join(current_lines).strip()))
                current_title = line[3:].strip()
                current_lines = []
            elif not line.startswith("# "):
                current_lines.append(line)
        if current_lines:
            sections.append((current_title, "\n".join(current_lines).strip()))

        for section_title, text in sections:
            haystack = f"{document['title']} {section_title} {text}".casefold()
            score = sum(haystack.count(term) for term in terms)
            if score == 0:
                continue
            matches.append({
                "source": document["source"],
                "title": document["title"],
                "section": section_title,
                "text": text,
                "distance": round(1 / (1 + score), 6),
                "relevance": score,
            })

    matches.sort(key=lambda item: item["relevance"], reverse=True)
    return matches[:top_k]


@router.post("/playbooks/search")
def playbook_search(
    request: PlaybookSearchRequest,
    _: dict[str, str] = Depends(get_current_user),
) -> dict[str, Any]:
    documents = _playbook_documents()

    try:
        from rag.retriever import retrieve_chunks

        matches = retrieve_chunks(request.query, top_k=request.top_k)
        return {
            "query": request.query,
            "mode": "semantic",
            "matches": [
                {
                    "source": match["source"],
                    "title": match["title"],
                    "section": match["section"],
                    "text": match["text"],
                    "distance": match["distance"],
                }
                for match in matches
            ],
        }
    except Exception as exc:  # pragma: no cover - depends on local model/DB
        matches = _keyword_search(request.query, documents, request.top_k)
        return {
            "query": request.query,
            "mode": "keyword-fallback",
            "warning": (
                "Semantic retrieval was unavailable; results use a local "
                f"keyword fallback. ({type(exc).__name__})"
            ),
            "matches": matches,
        }


# ============================================================
# REVIEW AUDIT
# ============================================================

@router.get("/review-audit")
def review_audit(
    limit: int = Query(default=50, ge=1, le=200),
    _: dict[str, str] = Depends(require_roles("admin", "analyst")),
) -> dict[str, Any]:
    if not AUDIT_PATH.exists():
        return {"count": 0, "items": []}

    lines = AUDIT_PATH.read_text(encoding="utf-8").splitlines()
    items: list[dict[str, Any]] = []
    for line in lines[-limit:]:
        try:
            items.append(json.loads(line))
        except json.JSONDecodeError:
            continue

    items.sort(key=lambda item: item.get("timestamp", ""), reverse=True)
    return {"count": len(items), "items": items}
