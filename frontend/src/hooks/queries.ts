import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  analyzeEvent,
  askQuestion,
  getAnalytics,
  getEvents,
  getHealth,
  getIdentities,
  getIdentity,
  getOverview,
  getPlaybooks,
  getProfiles,
  getProjectInfo,
  getReviewAudit,
  getThreatGraph,
  searchPlaybooks,
  submitReview,
} from "@/services/api/endpoints";
import { useAuth } from "@/services/auth/AuthContext";
import type {
  AccessEventInput,
  ReviewRespondInput,
} from "@/types/forms";

export const queryKeys = {
  overview: ["overview"] as const,
  identities: (search: string, status: string) =>
    ["identities", search, status] as const,
  identity: (userId: string) => ["identity", userId] as const,
  events: (params: Record<string, unknown>) => ["events", params] as const,
  threatGraph: ["threat-graph"] as const,
  analytics: ["analytics"] as const,
  playbooks: ["playbooks"] as const,
  profiles: ["profiles"] as const,
  reviewAudit: ["review-audit"] as const,
  health: ["health"] as const,
  project: ["project"] as const,
};

export function useHealth() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: getHealth,
    refetchInterval: 30_000,
    retry: 1,
  });
}

export function useProjectInfo() {
  return useQuery({
    queryKey: queryKeys.project,
    queryFn: getProjectInfo,
    staleTime: 5 * 60_000,
  });
}

export function useOverview() {
  const { session } = useAuth();
  return useQuery({
    queryKey: queryKeys.overview,
    queryFn: getOverview,
    enabled: Boolean(session),
    staleTime: 30_000,
  });
}

export function useIdentities(search = "", status = "all") {
  const { session } = useAuth();
  return useQuery({
    queryKey: queryKeys.identities(search, status),
    queryFn: () => getIdentities({ search, status }),
    enabled: Boolean(session),
    staleTime: 30_000,
    placeholderData: (previous) => previous,
  });
}

export function useIdentity(userId: string | undefined) {
  const { session } = useAuth();
  return useQuery({
    queryKey: queryKeys.identity(userId ?? ""),
    queryFn: () => getIdentity(userId ?? ""),
    enabled: Boolean(session && userId),
  });
}

export function useEvents(
  params: {
    risk_level?: string;
    user_id?: string;
    country?: string;
    search?: string;
    suspicious_only?: boolean;
    order?: "risk" | "recent";
    limit?: number;
    offset?: number;
  },
  enabled = true,
) {
  const { session } = useAuth();
  return useQuery({
    queryKey: queryKeys.events(params),
    queryFn: () => getEvents(params),
    enabled: Boolean(session && enabled),
    staleTime: 20_000,
  });
}

export function useThreatGraph() {
  const { session } = useAuth();
  return useQuery({
    queryKey: queryKeys.threatGraph,
    queryFn: getThreatGraph,
    enabled: Boolean(session),
    staleTime: 60_000,
  });
}

export function useAnalytics() {
  const { session } = useAuth();
  return useQuery({
    queryKey: queryKeys.analytics,
    queryFn: getAnalytics,
    enabled: Boolean(session),
    staleTime: 60_000,
  });
}

export function usePlaybooks() {
  const { session } = useAuth();
  return useQuery({
    queryKey: queryKeys.playbooks,
    queryFn: getPlaybooks,
    enabled: Boolean(session),
    staleTime: 5 * 60_000,
  });
}

export function useProfiles() {
  const { session } = useAuth();
  return useQuery({
    queryKey: queryKeys.profiles,
    queryFn: getProfiles,
    enabled: Boolean(session),
    staleTime: 5 * 60_000,
  });
}

export function useReviewAudit(enabled = true) {
  const { session } = useAuth();
  return useQuery({
    queryKey: queryKeys.reviewAudit,
    queryFn: () => getReviewAudit(100),
    enabled: Boolean(session && enabled),
  });
}

export function useAnalyzeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (event: AccessEventInput) => analyzeEvent(event),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.overview });
    },
  });
}

export function useAskMutation() {
  return useMutation({
    mutationFn: ({
      question,
      topK,
    }: {
      question: string;
      topK?: number;
    }) => askQuestion(question, topK),
  });
}

export function useReviewMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      analysisId,
      decision,
      comment,
    }: ReviewRespondInput) => submitReview(analysisId, decision, comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reviewAudit });
      queryClient.invalidateQueries({ queryKey: queryKeys.overview });
    },
  });
}

export function usePlaybookSearchMutation() {
  return useMutation({
    mutationFn: ({ query, topK }: { query: string; topK?: number }) =>
      searchPlaybooks(query, topK),
  });
}
