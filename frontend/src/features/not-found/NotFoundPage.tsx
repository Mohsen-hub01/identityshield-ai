import { ArrowLeft, Compass, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { ShieldMark } from "@/components/brand/ShieldMark";
import { Badge } from "@/components/ui/Badge";
import { buttonStyles } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export function NotFoundPage() {
  return (
    <div className="flex min-h-[65vh] items-center justify-center">
      <Card strong glow className="w-full max-w-lg overflow-hidden">
        <div className="relative p-8 text-center sm:p-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(0,217,255,0.12),transparent_60%)]" />
          <div className="relative">
            <div className="mx-auto flex size-16 items-center justify-center rounded-2xl border border-shield-cyan/20 bg-shield-cyan/[0.05]">
              <ShieldMark className="size-14" animated={false} />
            </div>
            <Badge tone="muted" className="mt-5">
              404 · Route not found
            </Badge>
            <h1 className="mt-3 font-display text-2xl font-semibold tracking-[-0.04em] text-cloud">
              This view is outside the perimeter.
            </h1>
            <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-mist">
              The page may have moved, or the link may be incomplete. Return to the
              command center or use search to find an identity.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
              <Link to="/" className={buttonStyles("primary", "md")}>
                <ArrowLeft className="size-4" />
                Back to overview
              </Link>
              <Link to="/identities" className={buttonStyles("secondary", "md")}>
                <Search className="size-4" />
                Search identities
              </Link>
            </div>
            <p className="mt-5 inline-flex items-center gap-1.5 text-[9px] text-mist/50">
              <Compass className="size-3" />
              IdentityShield AI · Synthetic research environment
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
