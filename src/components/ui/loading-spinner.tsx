import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface LoadingSpinnerProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  text?: string;
}

const sizeClasses = {
  sm: "w-4 h-4",
  md: "w-6 h-6",
  lg: "w-8 h-8"
};

export function LoadingSpinner({ className, size = "md", text }: LoadingSpinnerProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3", className)}>
      <Loader2 className={cn("animate-spin text-primary", sizeClasses[size])} />
      {text && <p className="text-sm text-muted-foreground">{text}</p>}
    </div>
  );
}

export function FullPageLoader({ text = "Carregando..." }: { text?: string }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <LoadingSpinner size="lg" text={text} />
    </div>
  );
}
