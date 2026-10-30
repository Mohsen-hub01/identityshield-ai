
import os
from typing import Annotated, Any, Literal

from fastapi import HTTPException
from mcp.server import MCPServer
from pydantic import BaseModel, Field


mcp = MCPServer("IdentityShield AI")


# ============================================================
# RESPONSE MODELS
# ============================================================

class PlaybookMatch(BaseModel):
    source: str
    title: str
    section: str
    distance: float
    text: str


class PlaybookSearchResult(BaseModel):
    query: str
    result_count: int
    matches: list[PlaybookMatch]


class UserProfileResult(BaseModel):
    user_id: str
    found: bool
    profile: dict[str, Any] | None = None
    message: str


class HumanReviewResult(BaseModel):
    status: str
    user_id: str
    risk_score: int
    risk_level: str
    ml_analysis: dict[str, Any]
    review_decision: str
    recommended_action: str
    disclaimer: str


class AccessAnalysisResult(BaseModel):
    user_id: str
    risk_score: int
    risk_level: str
    reasons: list[str]
    evaluated_at: str
    ml_analysis: dict[str, Any]
    recommended_action: str
    disclaimer: str

    status: str | None = None
    analysis_id: str | None = None
    review_request: dict[str, Any] | None = None


class AccessAnalysisErrorResult(BaseModel):
    """Structured business error returned when a user profile is missing."""

    error: bool = True
    code: Literal["PROFILE_NOT_FOUND"] = "PROFILE_NOT_FOUND"
    user_id: str
    message: str


# ============================================================
# SECURITY PLAYBOOK SEARCH
# ============================================================

@mcp.tool()
def search_security_playbook(
    query: Annotated[
        str,
        Field(min_length=3, max_length=2000),
    ],
    top_k: Annotated[
        int,
        Field(ge=1, le=5),
    ] = 3,
) -> PlaybookSearchResult:
    """Search security playbooks and return relevant passages."""

    query = query.strip()

    if len(query) < 3:
        raise ValueError(
            "La recherche doit contenir au moins 3 caractères."
        )

    from rag.retriever import retrieve_chunks

    matches = retrieve_chunks(query, top_k=top_k)

    return PlaybookSearchResult(
        query=query,
        result_count=len(matches),
        matches=[
            PlaybookMatch(
                source=item["source"],
                title=item["title"],
                section=item["section"],
                distance=item["distance"],
                text=item["text"],
            )
            for item in matches
        ],
    )


# ============================================================
# USER PROFILE
# ============================================================

@mcp.tool()
def get_user_profile(
    user_id: Annotated[
        str,
        Field(
            min_length=1,
            max_length=100,
            description="Identifiant du profil synthétique à consulter.",
        ),
    ],
) -> UserProfileResult:
    """Retrieve one synthetic user profile. Read-only tool."""

    from main import get_user_profile as load_user_profile

    user_id = user_id.strip()

    if not user_id:
        raise ValueError("L'identifiant ne doit pas être vide.")

    try:
        profile = load_user_profile(user_id)

    except HTTPException as exc:
        if exc.status_code == 404:
            return UserProfileResult(
                user_id=user_id,
                found=False,
                profile=None,
                message="Profil synthétique introuvable.",
            )
        raise

    return UserProfileResult(
        user_id=user_id,
        found=True,
        profile=profile,
        message="Profil synthétique trouvé.",
    )


# ============================================================
# ACCESS EVENT ANALYSIS
# ============================================================

@mcp.tool()
def analyze_access_event(
    user_id: Annotated[
        str,
        Field(min_length=1, max_length=100),
    ],
    country: Annotated[
        str,
        Field(min_length=2, max_length=100),
    ],
    hour: Annotated[
        int,
        Field(ge=0, le=23),
    ],
    failed_attempts: Annotated[
        int,
        Field(ge=0, le=100),
    ] = 0,
    new_device: Annotated[
        int,
        Field(ge=0, le=1),
    ] = 0,
    ip_risk_score: Annotated[
        float,
        Field(ge=0, le=100),
    ] = 0,
    impossible_travel: Annotated[
        int,
        Field(ge=0, le=1),
    ] = 0,
) -> AccessAnalysisResult | AccessAnalysisErrorResult:
    """
    Analyze a synthetic access event using IdentityShield's workflow.

    Read-only analysis tool. It does not block accounts or revoke sessions.

    Returns a structured error when the requested user profile is unknown.
    """

    from main import AccessEvent, analyze_access as run_access_analysis

    normalized_user_id = user_id.strip()

    event = AccessEvent(
        user_id=normalized_user_id,
        country=country.strip(),
        hour=hour,
        failed_attempts=failed_attempts,
        new_device=new_device,
        ip_risk_score=ip_risk_score,
        impossible_travel=impossible_travel,
    )

    try:
        result = run_access_analysis(event)

    except HTTPException as exc:
        if exc.status_code == 404:
            return AccessAnalysisErrorResult(
                user_id=normalized_user_id,
                message=(
                    "Profil synthétique introuvable pour "
                    f"{normalized_user_id}."
                ),
            )

        raise

    return AccessAnalysisResult.model_validate(result)


# ============================================================
# HUMAN REVIEW
# ============================================================

def submit_human_review_decision(
    analysis_id: Annotated[
        str,
        Field(
            min_length=1,
            description="Identifiant de l'analyse en attente.",
        ),
    ],
    decision: Literal[
        "confirm_suspicious",
        "mark_legitimate",
    ],
    confirm: Annotated[
        bool,
        Field(
            description="Confirmation explicite de la décision humaine.",
        ),
    ] = False,
) -> HumanReviewResult:
    """
    Submit a human review decision for a pending access analysis.

    This action resumes the workflow and writes an audit record.
    """

    if not confirm:
        raise ValueError(
            "Confirmation requise avant de soumettre la décision."
        )

    from main import (
        ReviewDecisionRequest,
        submit_human_review as execute_review,
    )

    request = ReviewDecisionRequest(
        analysis_id=analysis_id,
        decision=decision,
    )

    try:
        result = execute_review(request)

    except HTTPException as exc:
        raise ValueError(
            f"Revue impossible ({exc.status_code}) : {exc.detail}"
        ) from None

    return HumanReviewResult.model_validate(result)


# ============================================================
# OPTIONAL HUMAN REVIEW TOOL REGISTRATION
# ============================================================

# Human-review execution is opt-in, not enabled by default.
if (
    os.getenv("IDENTITYSHIELD_ENABLE_MCP_REVIEW_TOOL", "")
    .strip()
    .lower()
    == "true"
):
    mcp.add_tool(submit_human_review_decision)


# ============================================================
# SERVER ENTRY POINT
# ============================================================

if __name__ == "__main__":
    mcp.run(transport="stdio")
