import { Fragment, useMemo, type ReactNode } from "react";
import { cn } from "@/lib/utils";

function inline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[S\d+\])/g);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-semibold text-cloud">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={index}
          className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[0.85em] text-shield-cyan"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (/^\[S\d+\]$/.test(part)) {
      return (
        <span
          key={index}
          className="mx-0.5 inline-flex rounded border border-shield-cyan/20 bg-shield-cyan/[0.07] px-1 font-mono text-[10px] font-semibold text-shield-cyan"
        >
          {part}
        </span>
      );
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
}

export function MarkdownLite({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const blocks = useMemo(() => {
    const lines = content.replace(/\r\n/g, "\n").split("\n");
    const output: ReactNode[] = [];
    let paragraph: string[] = [];
    let list: { ordered: boolean; items: string[] } | null = null;

    const flushParagraph = () => {
      if (!paragraph.length) return;
      output.push(
        <p key={`p-${output.length}`} className="text-[13px] leading-6 text-mist">
          {inline(paragraph.join(" "))}
        </p>,
      );
      paragraph = [];
    };

    const flushList = () => {
      if (!list) return;
      const Tag = list.ordered ? "ol" : "ul";
      output.push(
        <Tag
          key={`l-${output.length}`}
          className={cn(
            "space-y-1.5 pl-4 text-[13px] leading-6 text-mist",
            list.ordered ? "list-decimal" : "list-disc",
          )}
        >
          {list.items.map((item, index) => (
            <li key={index} className="pl-1 marker:text-shield-cyan/70">
              {inline(item)}
            </li>
          ))}
        </Tag>,
      );
      list = null;
    };

    for (const rawLine of lines) {
      const line = rawLine.trimEnd();
      if (!line.trim()) {
        flushParagraph();
        flushList();
        continue;
      }

      const heading = /^(#{1,4})\s+(.*)$/.exec(line);
      if (heading) {
        flushParagraph();
        flushList();
        const level = heading[1].length;
        output.push(
          <h3
            key={`h-${output.length}`}
            className={cn(
              "font-display font-semibold tracking-[-0.02em] text-cloud",
              level <= 2 ? "text-sm" : "text-xs uppercase tracking-[0.12em] text-mist",
            )}
          >
            {inline(heading[2])}
          </h3>,
        );
        continue;
      }

      const bullet = /^[-*]\s+(.*)$/.exec(line);
      if (bullet) {
        flushParagraph();
        if (!list || list.ordered) {
          flushList();
          list = { ordered: false, items: [] };
        }
        list.items.push(bullet[1]);
        continue;
      }

      const ordered = /^\d+[.)]\s+(.*)$/.exec(line);
      if (ordered) {
        flushParagraph();
        if (!list || !list.ordered) {
          flushList();
          list = { ordered: true, items: [] };
        }
        list.items.push(ordered[1]);
        continue;
      }

      if (line.startsWith("> ")) {
        flushParagraph();
        flushList();
        output.push(
          <blockquote
            key={`q-${output.length}`}
            className="border-l-2 border-shield-cyan/30 pl-3 text-[13px] italic leading-6 text-mist/90"
          >
            {inline(line.slice(2))}
          </blockquote>,
        );
        continue;
      }

      paragraph.push(line.trim());
    }

    flushParagraph();
    flushList();
    return output;
  }, [content]);

  return <div className={cn("space-y-3", className)}>{blocks}</div>;
}
