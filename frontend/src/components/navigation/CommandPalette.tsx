import { ArrowDown, ArrowUp, CornerDownLeft, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { flatNavigation, type NavItem } from "@/app/navigation";
import { cn } from "@/lib/utils";

export function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return flatNavigation;
    return flatNavigation.filter((item) => {
      const haystack = [
        item.label,
        item.description,
        ...item.keywords,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 40);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((current) =>
          results.length ? (current + 1) % results.length : 0,
        );
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((current) =>
          results.length ? (current - 1 + results.length) % results.length : 0,
        );
      }
      if (event.key === "Enter" && results[activeIndex]) {
        event.preventDefault();
        navigate(results[activeIndex].href);
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, navigate, onClose, open, results]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center px-4 pt-[12vh]">
      <button
        type="button"
        aria-label="Close search"
        className="absolute inset-0 bg-ink-950/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="panel-strong page-enter relative z-10 w-full max-w-xl overflow-hidden rounded-2xl">
        <div className="flex items-center gap-3 border-b border-white/[0.07] px-4">
          <Search className="size-4 text-shield-cyan" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            placeholder="Search views, investigations and tools…"
            className="h-14 flex-1 bg-transparent text-sm text-cloud placeholder:text-mist/60 focus:outline-none"
            aria-label="Search application"
          />
          <kbd className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-mist">
            ESC
          </kbd>
        </div>
        <div className="max-h-[52vh] overflow-y-auto p-2">
          {results.length ? (
            results.map((item: NavItem, index: number) => (
              <button
                key={item.href}
                type="button"
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => {
                  navigate(item.href);
                  onClose();
                }}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                  index === activeIndex
                    ? "bg-shield-cyan/[0.08]"
                    : "hover:bg-white/[0.035]",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-8 items-center justify-center rounded-lg border",
                    index === activeIndex
                      ? "border-shield-cyan/25 bg-shield-cyan/[0.08] text-shield-cyan"
                      : "border-white/[0.07] bg-white/[0.025] text-mist",
                  )}
                >
                  <item.icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium text-cloud">
                    {item.label}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-mist">
                    {item.description}
                  </span>
                </span>
                {index === activeIndex ? (
                  <CornerDownLeft className="mt-1 size-3.5 text-shield-cyan/70" />
                ) : null}
              </button>
            ))
          ) : (
            <p className="px-3 py-10 text-center text-xs text-mist">
              No matching view. Try “risk”, “playbook” or “incident”.
            </p>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-white/[0.07] px-4 py-2.5 text-[10px] text-mist">
          <span className="inline-flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <ArrowUp className="size-3" />
              <ArrowDown className="size-3" /> navigate
            </span>
            <span className="inline-flex items-center gap-1">
              <CornerDownLeft className="size-3" /> open
            </span>
          </span>
          <span>IdentityShield command search</span>
        </div>
      </div>
    </div>
  );
}
