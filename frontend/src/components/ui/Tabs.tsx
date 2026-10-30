import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface TabItem {
  value: string;
  label: string;
  count?: number;
  icon?: ReactNode;
}

export function Tabs({
  items,
  value,
  onChange,
  className,
}: {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex flex-wrap items-center gap-1 rounded-xl border border-white/[0.08] bg-ink-950/45 p-1",
        className,
      )}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              active
                ? "bg-white/[0.09] text-cloud shadow-sm"
                : "text-mist hover:bg-white/[0.04] hover:text-cloud",
            )}
          >
            {item.icon}
            {item.label}
            {item.count !== undefined ? (
              <span
                className={cn(
                  "rounded-md px-1.5 py-0.5 font-mono text-[10px]",
                  active ? "bg-shield-cyan/15 text-shield-cyan" : "bg-white/[0.05] text-mist",
                )}
              >
                {item.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
