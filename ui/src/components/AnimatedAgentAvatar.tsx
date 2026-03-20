import { memo } from "react";
import { cn } from "@/lib/utils";
import { AgentIcon } from "./AgentIconPicker";

interface AnimatedAgentAvatarProps {
  icon: string | null | undefined;
  status: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  isRunning?: boolean;
}

const SIZE_CLASSES = {
  sm: "h-8 w-8",
  md: "h-12 w-12",
  lg: "h-16 w-16",
  xl: "h-24 w-24",
};

const STATUS_ANIMATION: Record<string, string> = {
  active: "avatar-active",
  running: "avatar-running",
  paused: "avatar-paused",
  idle: "avatar-idle",
  error: "avatar-error",
  terminated: "avatar-terminated",
};

/**
 * AnimatedAgentAvatar - Displays agent icon with status-based animations
 * 
 * Animations:
 * - active: Subtle pulse glow (green)
 * - running: Continuous spin animation
 * - paused: Slow fade in/out
 * - idle: Gentle bounce
 * - error: Shake animation with red glow
 * - terminated: Grayscale with no animation
 */
export const AnimatedAgentAvatar = memo(function AnimatedAgentAvatar({
  icon,
  status,
  size = "md",
  className,
  isRunning,
}: AnimatedAgentAvatarProps) {
  const sizeClass = SIZE_CLASSES[size];
  const animationClass = STATUS_ANIMATION[status] || "";
  const isAnimated = status !== "terminated";

  return (
    <div
      className={cn(
        "relative flex items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-primary/20 shadow-lg transition-all duration-300",
        sizeClass,
        animationClass,
        className
      )}
    >
      {/* Status indicator ring */}
      {status === "active" && (
        <div className="absolute inset-0 rounded-xl border-2 border-green-500/30 animate-pulse" />
      )}
      {status === "running" && (
        <div className="absolute inset-0 rounded-xl border-2 border-blue-500/50 animate-ping-slow" />
      )}
      {status === "error" && (
        <div className="absolute inset-0 rounded-xl border-2 border-red-500/50 animate-pulse" />
      )}

      {/* Agent icon */}
      <AgentIcon
        icon={icon}
        className={cn(
          "transition-all duration-300",
          size === "sm" && "h-4 w-4",
          size === "md" && "h-6 w-6",
          size === "lg" && "h-8 w-8",
          size === "xl" && "h-12 w-12",
          status === "terminated" && "grayscale opacity-50",
          isRunning && "animate-icon-bounce"
        )}
      />

      {/* Status dot indicator */}
      <div
        className={cn(
          "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background shadow-sm",
          status === "active" && "bg-green-500",
          status === "running" && "bg-blue-500 animate-pulse",
          status === "paused" && "bg-yellow-500",
          status === "idle" && "bg-gray-400",
          status === "error" && "bg-red-500 animate-pulse",
          status === "terminated" && "bg-gray-600"
        )}
      />
    </div>
  );
});
