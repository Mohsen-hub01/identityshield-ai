import { Database } from "lucide-react";
import type { DatasetNote } from "@/types/api";
import { cn } from "@/lib/utils";

export function ProvenanceBadge({
  dataset,
  className,
}: {
  dataset?: DatasetNote;
  className?: string;
}) {
  return (
    <span
      title={dataset?.note}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-mist",
        className,
      )}
    >
      <Database className="size-3 text-shield-cyan/80" />
      Synthetic dataset
    </span>
  );
}
