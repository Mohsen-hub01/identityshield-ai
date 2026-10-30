import { useId } from "react";
import { cn } from "@/lib/utils";

export function ShieldMark({
  className,
  animated = true,
}: {
  className?: string;
  animated?: boolean;
}) {
  const id = useId().replace(/:/g, "");

  return (
    <span className={cn("relative inline-flex size-9 items-center justify-center", className)}>
      <span
        className={cn(
          "absolute inset-0 rounded-xl border border-shield-cyan/20 bg-shield-cyan/[0.04]",
          animated && "spin-slow",
        )}
        style={{ borderRadius: "12px" }}
        aria-hidden
      />
      <svg
        viewBox="0 0 32 32"
        className="relative size-6 drop-shadow-[0_0_10px_rgba(0,217,255,0.45)]"
        aria-hidden
      >
        <defs>
          <linearGradient id={`${id}-g`} x1="4" y1="2" x2="28" y2="30">
            <stop offset="0%" stopColor="#00E5C3" />
            <stop offset="52%" stopColor="#00D9FF" />
            <stop offset="100%" stopColor="#3878FF" />
          </linearGradient>
        </defs>
        <path
          d="M16 2.6 27 6.7v8.2c0 6.8-4.4 12.1-11 14.5C9.4 27 5 21.7 5 14.9V6.7L16 2.6Z"
          fill="none"
          stroke={`url(#${id}-g)`}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M16 8.2 22 10.5v4.4c0 3.9-2.3 7-6 8.5-3.7-1.5-6-4.6-6-8.5v-4.4L16 8.2Z"
          fill={`url(#${id}-g)`}
          fillOpacity="0.13"
          stroke={`url(#${id}-g)`}
          strokeWidth="0.8"
        />
        <path
          d="M13 16.2 15.2 18.4 19.4 13.6"
          fill="none"
          stroke="#00E5C3"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
