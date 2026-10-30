import { Badge } from "@/components/ui/Badge";
import type { RiskLevel, RiskStatus } from "@/types/api";

export function RiskBadge({
  level,
  className,
}: {
  level: RiskLevel;
  className?: string;
}) {
  const tone = level === "HIGH" ? "danger" : level === "MEDIUM" ? "warning" : "success";
  const label = level === "HIGH" ? "High risk" : level === "MEDIUM" ? "Medium" : "Low";
  return (
    <Badge tone={tone} dot className={className}>
      {label}
    </Badge>
  );
}

export function StatusBadge({
  status,
  className,
}: {
  status: RiskStatus;
  className?: string;
}) {
  const tone =
    status === "critical" ? "danger" : status === "elevated" ? "warning" : "success";
  const label =
    status === "critical" ? "Critical" : status === "elevated" ? "Elevated" : "Normal";
  return (
    <Badge tone={tone} dot className={className}>
      {label}
    </Badge>
  );
}
