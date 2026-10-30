import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("shimmer rounded-lg bg-white/[0.035]", className)}
      aria-hidden
    />
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("panel rounded-2xl p-5", className)}>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-4 h-8 w-40" />
      <Skeleton className="mt-3 h-2.5 w-full" />
      <Skeleton className="mt-2 h-2.5 w-2/3" />
    </div>
  );
}
