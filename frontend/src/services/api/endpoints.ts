import { apiFetch, buildQuery } from "@/services/api/client";
import type {
  AccessEventInput,
  AnalyzeResponse,
  AnalyticsResponse,
  AskResponse,
  EventsResponse,
  HealthResponse,
  IdentitiesResponse,
  IdentityDetailResponse,
  OverviewResponse,
  PlaybookSearchResponse,
  PlaybooksResponse,
  ProfilesResponse,
  ProjectInfo,
  ReviewAuditResponse,
  ReviewResponse,
  ThreatGraphResponse,
  TokenResponse,
} from "@/types/api";

export interface LoginResult {
  token: string;
  tokenType: string;
}

export async function loginRequest(
  username: string,
  password: string,
): Promise<LoginResult> {
  const body = new URLSearchParams();
  body.set("username", username);
  body.set("password", password);

  const response = await apiFetch<TokenResponse>("/token", {
    method: "POST",
    auth: false,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  return { token: response.access_token, tokenType: response.token_type };
}

export function getHealth() {
  return apiFetch<HealthResponse>("/health", { auth: false });
}

export function getProjectInfo() {
  return apiFetch<ProjectInfo>("/", { auth: false });
}

export function getProfiles() {
  return apiFetch<ProfilesResponse>("/profiles");
}

export function getOverview() {
  return apiFetch<OverviewResponse>("/api/ui/overview");
}

export function getIdentities(params: {
  search?: string;
  status?: string;
} = {}) {
  return apiFetch<IdentitiesResponse>(
    `/api/ui/identities${buildQuery(params)}`,
  );
}

export function getIdentity(userId: string) {
  return apiFetch<IdentityDetailResponse>(
    `/api/ui/identities/${encodeURIComponent(userId)}`,
  );
}

export function getEvents(
  params: {
    risk_level?: string;
    user_id?: string;
    country?: string;
    search?: string;
    suspicious_only?: boolean;
    order?: "risk" | "recent";
    limit?: number;
    offset?: number;
  } = {},
) {
  return apiFetch<EventsResponse>(`/api/ui/events${buildQuery(params)}`);
}

export function getThreatGraph() {
  return apiFetch<ThreatGraphResponse>("/api/ui/threat-graph");
}

export function getAnalytics() {
  return apiFetch<AnalyticsResponse>("/api/ui/analytics");
}

export function getPlaybooks() {
  return apiFetch<PlaybooksResponse>("/api/ui/playbooks");
}

export function searchPlaybooks(query: string, topK = 3) {
  return apiFetch<PlaybookSearchResponse>("/api/ui/playbooks/search", {
    method: "POST",
    body: JSON.stringify({ query, top_k: topK }),
  });
}

export function analyzeEvent(event: AccessEventInput) {
  return apiFetch<AnalyzeResponse>("/analyze", {
    method: "POST",
    body: JSON.stringify(event),
  });
}

export function askQuestion(question: string, topK = 3) {
  return apiFetch<AskResponse>("/ask", {
    method: "POST",
    body: JSON.stringify({ question, top_k: topK }),
  });
}

export function submitReview(
  analysisId: string,
  decision: "confirm_suspicious" | "mark_legitimate",
  comment?: string,
) {
  return apiFetch<ReviewResponse>("/review", {
    method: "POST",
    body: JSON.stringify({
      analysis_id: analysisId,
      decision,
      comment: comment || null,
    }),
  });
}

export function getReviewAudit(limit = 50) {
  return apiFetch<ReviewAuditResponse>(
    `/api/ui/review-audit${buildQuery({ limit })}`,
  );
}
