import {
  forwardRef,
  type InputHTMLAttributes,
  type LabelHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

const controlBase =
  "w-full rounded-xl border border-white/10 bg-ink-950/55 text-sm text-cloud placeholder:text-mist/60 transition-colors duration-200 hover:border-white/16 focus:border-shield-cyan/55 focus:outline-none focus:ring-2 focus:ring-shield-cyan/10 disabled:cursor-not-allowed disabled:opacity-50";

export function Label({
  className,
  children,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-mist",
        className,
      )}
      {...props}
    >
      {children}
    </label>
  );
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="mt-1.5 text-[11px] leading-4 text-mist/80">{children}</p>;
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  leadingIcon?: ReactNode;
  trailing?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, leadingIcon, trailing, ...props },
  ref,
) {
  return (
    <div className="relative">
      {leadingIcon ? (
        <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-mist">
          {leadingIcon}
        </span>
      ) : null}
      <input
        ref={ref}
        className={cn(
          controlBase,
          "h-10 px-3.5",
          leadingIcon && "pl-10",
          trailing && "pr-10",
          className,
        )}
        {...props}
      />
      {trailing ? (
        <span className="absolute inset-y-0 right-3 flex items-center text-mist">
          {trailing}
        </span>
      ) : null}
    </div>
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn(controlBase, "h-10 appearance-none px-3.5", className)}
      {...props}
    >
      {children}
    </select>
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        controlBase,
        "min-h-24 resize-y px-3.5 py-3 leading-6",
        className,
      )}
      {...props}
    />
  );
});
