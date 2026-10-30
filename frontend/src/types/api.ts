export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";
export type RiskStatus = "normal" | "elevated" | "critical";
export type Role = "admin" | "analyst" | "viewer";

export interface DatasetNote {
  synthetic: boolean;
  source: string;
  profiles: string;
  note: string;
}

export interface RiskDistributionItem {
  level: RiskLevel;
  count: number;
  share: number;
}

export interface OverviewCounts {
  identities: number;
  events: number;
  suspicious_events: number;
  high_risk_events: number;
  medium_risk_events: number;
  low_risk_events: number;
  critical_identities: number;
  elevated_identities: number;
}

export interface HourlyActivity {
  hour: number;
  events: number;
  suspicious: number;
  high_risk?: number;
}

export interface CountryActivity {
  country: string;
  events: number;
  suspicious: number;
  high_risk: number;
  average_ip_risk: number;
}

export interface EventRecord {
  event_id: string;
  user_id: string;
  country: string;
  home_country: string;
  usual_hour: number;
  hour: number;
  failed_attempts: number;
  new_device: number;
  ip_risk_score: number;
  impossible_travel: number;
  risk_score: number;
  risk_level: RiskLevel;
  dataset_label: "suspicious" | "benign";
  country_unusual: number;
  hour_unusual: number;
}

export interface IdentitySummary {
  user_id: string;
  home_country: string;
  usual_hour: number;
  event_count: number;
  suspicious_count: number;
  high_risk_count: number;
  medium_risk_count: number;
  recent_high_risk_count: number;
  recent_medium_risk_count: number;
  recent_max_risk_score: number;
  risk_score: number;
  new_device_count: number;
  impossible_travel_count: number;
  average_failed_attempts: number;
  historical_max_risk_score: number;
  average_risk_score: number;
  status: RiskStatus;
  last_event_id: string;
  last_country: string;
  last_hour: number;
  last_risk_level: RiskLevel;
  last_dataset_label: "suspicious" | "benign";
  top_countries: Array<{ country: string; count: number }>;
  risk_series: Array<{ event_id: string; risk_score: number }>;
}

export interface Insight {
  tone: "critical" | "warning" | "info" | "success";
  title: string;
  detail: string;
}

export interface ModelSummary {
  name: string;
  threshold: number;
  accuracy: number | null;
  precision: number | null;
  recall: number | null;
  f1: number | null;
  average_precision: number | null;
  test_size: number | null;
  confusion: {
    tn: number | null;
    fp: number | null;
    fn: number | null;
    tp: number | null;
  };
}

export interface OverviewResponse {
  generated_at: string;
  dataset: DatasetNote;
  counts: OverviewCounts;
  risk_distribution: RiskDistributionItem[];
  posture: {
    low_risk_share: number;
    label: string;
    note: string;
  };
  hourly_activity: HourlyActivity[];
  country_activity: CountryActivity[];
  priority_incidents: EventRecord[];
  latest_events: EventRecord[];
  top_identities: IdentitySummary[];
  insights: Insight[];
  model: ModelSummary;
}

export interface IdentitiesResponse {
  count: number;
  dataset: DatasetNote;
  identities: IdentitySummary[];
}

export interface IdentityDetailResponse {
  identity: IdentitySummary;
  dataset: DatasetNote;
  recent_events: EventRecord[];
  risk_series: Array<{ event_id: string; risk_score: number }>;
}

export interface EventsResponse {
  count: number;
  limit: number;
  offset: number;
  events: EventRecord[];
  dataset: DatasetNote;
}

export interface ThreatNode {
  id: string;
  label: string;
  type: "identity" | "country";
  risk_score: number;
  risk_level: RiskLevel;
  event_count: number;
  home_country: string | null;
}

export interface ThreatLink {
  source: string;
  target: string;
  events: number;
  suspicious: number;
  high_risk: number;
  max_risk: number;
}

export interface ThreatGraphResponse {
  nodes: ThreatNode[];
  links: ThreatLink[];
  dataset: DatasetNote;
  note: string;
}

export interface AnalyticsResponse {
  generated_at: string;
  dataset: DatasetNote;
  risk_distribution: RiskDistributionItem[];
  hourly_activity: HourlyActivity[];
  country_activity: CountryActivity[];
  failed_attempt_distribution: Array<{ bucket: string; events: number }>;
  signals: {
    new_device_share: number;
    impossible_travel_share: number;
    foreign_country_share: number;
    unusual_hour_share: number;
    average_ip_risk: number;
  };
  sequence_trend: Array<{
    sequence: string;
    suspicious_share: number;
    high_risk_share: number;
    events: number;
  }>;
  model: {
    selected: Record<string, unknown>;
    final_metrics: Record<string, unknown>;
    threshold_validation: Array<Record<string, unknown>>;
  };
}

export interface PlaybookDocument {
  id: string;
  title: string;
  filename: string;
  source: string;
  sections: string[];
  content: string;
  word_count: number;
}

export interface PlaybooksResponse {
  count: number;
  documents: PlaybookDocument[];
  mode: string;
}

export interface PlaybookMatch {
  source: string;
  title: string;
  section: string;
  text: string;
  distance: number;
  relevance?: number;
}

export interface PlaybookSearchResponse {
  query: string;
  mode: "semantic" | "keyword-fallback";
  warning?: string;
  matches: PlaybookMatch[];
}

export interface ReviewAuditRecord {
  timestamp: string;
  analysis_id: string;
  user_id: string;
  risk_score: number;
  risk_level: RiskLevel;
  review_decision: "confirm_suspicious" | "mark_legitimate";
  recommended_action: string;
  reviewer_identity: null;
  reviewer?: string | null;
  comment?: string | null;
}

export interface ReviewAuditResponse {
  count: number;
  items: ReviewAuditRecord[];
}

export interface Profile {
  home_country: string;
  usual_hour: number;
}

export interface ProfilesResponse {
  count: number;
  profiles: Record<string, Profile>;
}

export interface AccessEventInput {
  user_id: string;
  country: string;
  hour: number;
  failed_attempts: number;
  new_device: number;
  ip_risk_score: number;
  impossible_travel: number;
}

export interface ShapExplanation {
  factor: string;
  shap_value: number;
  direction: "increases_suspicion" | "decreases_suspicion" | "neutral";
}

export interface MlAnalysis {
  prediction: "SUSPECT" | "NORMAL";
  suspect_probability: number;
  decision_threshold: number;
  explanations: ShapExplanation[];
}

export interface ReviewRequest {
  message: string;
  user_id: string;
  risk_score: number;
  risk_level: RiskLevel;
  allowed_decisions: Array<"confirm_suspicious" | "mark_legitimate">;
}

export interface AnalyzeResponse {
  status?: "awaiting_human_review";
  analysis_id?: string;
  user_id: string;
  risk_score: number;
  risk_level: RiskLevel;
  reasons: string[];
  evaluated_at: string;
  ml_analysis: MlAnalysis;
  recommended_action: string;
  review_request?: ReviewRequest;
  disclaimer: string;
}

export interface ReviewResponse {
  status: "review_completed";
  user_id: string;
  risk_score: number;
  risk_level: RiskLevel;
  ml_analysis: MlAnalysis;
  review_decision: "confirm_suspicious" | "mark_legitimate";
  recommended_action: string;
  reviewed_by: string;
  comment: string | null;
  disclaimer: string;
}

export interface AskSource {
  id: string;
  title: string;
  section: string;
  source: string;
  distance: number;
}

export interface AskResponse {
  question: string;
  answer: string;
  sources: AskSource[];
  model: string | null;
}

export interface TokenResponse {
  access_token: string;
  token_type: "bearer";
}

export interface SessionUser {
  username: string;
  role: Role;
}

export interface Session {
  token: string;
  user: SessionUser;
  expiresAt: number;
}

export interface HealthResponse {
  status: string;
  timestamp: string;
}

export interface ProjectInfo {
  project: string;
  message: string;
  version: string;
  model: string;
  decision_threshold: number;
}

export interface PendingReview {
  analysisId: string;
  createdAt: string;
  result: AnalyzeResponse;
  event: AccessEventInput;
  note?: string;
}
