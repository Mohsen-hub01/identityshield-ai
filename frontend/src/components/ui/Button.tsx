import { LoaderCircle } from "lucide-react";
import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg" | "icon";

const variants: Record<Variant, string> = {
  primary:
    "bg-gradient-to-r from-shield-cyan to-shield-teal text-ink-950 shadow-[0_10px_36px_-14px_rgba(0,217,255,0.65)] hover:brightness-110 active:brightness-95",
  secondary:
    "border border-white/10 bg-white/[0.055] text-cloud hover:border-white/20 hover:bg-white/[0.09]",
  ghost:
    "text-mist hover:bg-white/[0.06] hover:text-cloud",
  danger:
    "border border-danger/30 bg-danger/10 text-danger hover:bg-danger/16",
  outline:
    "border border-shield-cyan/30 bg-shield-cyan/[0.04] text-shield-cyan hover:bg-shield-cyan/[0.09]",
};

const sizes: Record<Size, string> = {
  sm: "h-8 gap-1.5 rounded-lg px-3 text-xs",
  md: "h-10 gap-2 rounded-xl px-4 text-sm",
  lg: "h-12 gap-2.5 rounded-xl px-5 text-sm",
  icon: "h-9 w-9 rounded-lg",
};

export function buttonStyles(variant: Variant = "primary", size: Size = "md") {
  return cn(
    "inline-flex select-none items-center justify-center font-medium transition-[background,color,border-color,box-shadow,filter,transform] duration-200 disabled:pointer-events-none disabled:opacity-45",
    variants[variant],
    sizes[size],
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      className,
      variant = "primary",
      size = "md",
      loading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      type = "button",
      ...props
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(buttonStyles(variant, size), className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
        ) : (
          leftIcon
        )}
        {children}
        {rightIcon}
      </button>
    );
  },
);
