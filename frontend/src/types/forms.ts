export type { AccessEventInput } from "@/types/api";

export interface AccessEventFormValues {
  user_id: string;
  country: string;
  hour: string;
  failed_attempts: string;
  new_device: boolean;
  ip_risk_score: string;
  impossible_travel: boolean;
}

export interface ReviewRespondInput {
  analysisId: string;
  decision: "confirm_suspicious" | "mark_legitimate";
  comment?: string;
}

export interface CopilotEventDraft {
  user_id: string;
  country: string;
  hour: string;
  failed_attempts: string;
  new_device: boolean;
  ip_risk_score: string;
  impossible_travel: boolean;
}
