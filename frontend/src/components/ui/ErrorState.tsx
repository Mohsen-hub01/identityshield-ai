import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function ErrorState({
  title = "Unable to load this view",
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-danger/15 bg-danger/[0.035] px-6 py-12 text-center">
      <div className="mb-4 flex size-11 items-center justify-center rounded-xl border border-danger/20 bg-danger/[0.07] text-danger">
        <AlertTriangle className="size-5" />
      </div>
      <h3 className="font-display text-sm font-semibold text-cloud">{title}</h3>
      <p className="mt-2 max-w-md text-xs leading-5 text-mist">{message}</p>
      {onRetry ? (
        <Button
          variant="secondary"
          size="sm"
          className="mt-5"
          leftIcon={<RotateCcw className="size-3.5" />}
          onClick={onRetry}
        >
          Retry
        </Button>
      ) : null}
    </div>
  );
}
