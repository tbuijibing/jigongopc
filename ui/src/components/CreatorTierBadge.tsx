import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Crown,
  Gem,
  Award,
  Star,
  Shield,
  Zap,
  CheckCircle,
} from "lucide-react";

export type CreatorTier =
  | "bronze"
  | "silver"
  | "gold"
  | "platinum"
  | "diamond"
  | "legend";

interface CreatorTierConfig {
  name: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: React.ElementType;
  benefits: string[];
  minSales: number;
  minTemplates: number;
}

const TIER_CONFIG: Record<CreatorTier, CreatorTierConfig> = {
  bronze: {
    name: "Bronze",
    color: "text-amber-700",
    bgColor: "bg-amber-100",
    borderColor: "border-amber-300",
    icon: Star,
    benefits: [
      "Basic analytics dashboard",
      "Community support",
      "Standard template publishing",
    ],
    minSales: 0,
    minTemplates: 1,
  },
  silver: {
    name: "Silver",
    color: "text-slate-600",
    bgColor: "bg-slate-100",
    borderColor: "border-slate-300",
    icon: Shield,
    benefits: [
      "Advanced analytics",
      "Priority support",
      "Featured placement eligibility",
      "Custom template branding",
    ],
    minSales: 100,
    minTemplates: 3,
  },
  gold: {
    name: "Gold",
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-400",
    icon: Award,
    benefits: [
      "Real-time analytics",
      "Dedicated support channel",
      "Enhanced featured placement",
      "Early access to new features",
      "Revenue share bonus: +5%",
    ],
    minSales: 500,
    minTemplates: 5,
  },
  platinum: {
    name: "Platinum",
    color: "text-cyan-600",
    bgColor: "bg-cyan-50",
    borderColor: "border-cyan-400",
    icon: Gem,
    benefits: [
      "Advanced revenue analytics",
      "Priority review queue",
      "Homepage featured slots",
      "Beta feature access",
      "Revenue share bonus: +10%",
      "Marketing collaboration",
    ],
    minSales: 2000,
    minTemplates: 10,
  },
  diamond: {
    name: "Diamond",
    color: "text-indigo-600",
    bgColor: "bg-indigo-50",
    borderColor: "border-indigo-400",
    icon: Zap,
    benefits: [
      "Full analytics suite",
      "VIP support",
      "Guaranteed featured placement",
      "Custom integrations",
      "Revenue share bonus: +15%",
      "Co-marketing opportunities",
      "Direct feedback channel",
    ],
    minSales: 10000,
    minTemplates: 20,
  },
  legend: {
    name: "Legend",
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-400",
    icon: Crown,
    benefits: [
      "Enterprise analytics",
      "White-glove support",
      "Strategic partnership",
      "Revenue share bonus: +20%",
      "Exclusive events access",
      "Product advisory board",
      "Custom feature requests",
    ],
    minSales: 50000,
    minTemplates: 50,
  },
};

interface CreatorTierBadgeProps {
  tier: CreatorTier;
  showIcon?: boolean;
  showLabel?: boolean;
  showVerified?: boolean;
  size?: "xs" | "sm" | "default" | "lg";
  variant?: "default" | "outlined" | "minimal";
  className?: string;
}

interface CreatorTierWithProgressProps extends CreatorTierBadgeProps {
  currentSales: number;
  currentTemplates: number;
  showProgress?: boolean;
}

export function CreatorTierBadge({
  tier,
  showIcon = true,
  showLabel = true,
  showVerified = false,
  size = "default",
  variant = "default",
  className,
}: CreatorTierBadgeProps) {
  const { t } = useTranslation();
  const config = TIER_CONFIG[tier];
  const Icon = config.icon;

  const sizeClasses = {
    xs: "h-4 text-[10px] px-1 gap-0.5",
    sm: "h-5 text-xs px-1.5 gap-1",
    default: "h-6 text-xs px-2 gap-1.5",
    lg: "h-8 text-sm px-3 gap-2",
  };

  const iconSizes = {
    xs: "h-2.5 w-2.5",
    sm: "h-3 w-3",
    default: "h-3.5 w-3.5",
    lg: "h-4 w-4",
  };

  if (variant === "minimal") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn(
                "inline-flex items-center justify-center rounded-full",
                config.bgColor,
                size === "xs" && "h-4 w-4",
                size === "sm" && "h-5 w-5",
                size === "default" && "h-6 w-6",
                size === "lg" && "h-8 w-8",
                className
              )}
            >
              <Icon className={cn(config.color, iconSizes[size])} />
            </span>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p className="font-medium">{config.name}</p>
            <p className="text-xs text-muted-foreground">
              {t("creator.tierBadge", "{{tier}} Creator", { tier: config.name })}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn(
              "inline-flex items-center font-medium border-2 cursor-help",
              config.color,
              config.bgColor,
              config.borderColor,
              sizeClasses[size],
              className
            )}
          >
            {showIcon && <Icon className={iconSizes[size]} />}
            {showLabel && (
              <span>{t("creator.tierBadge", "{{tier}} Creator", { tier: config.name })}</span>
            )}
            {showVerified && (
              <CheckCircle className={cn("text-emerald-500", iconSizes[size])} />
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Icon className={cn("h-4 w-4", config.color)} />
              <p className="font-semibold">{config.name} Creator</p>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("creator.tierRequirements", "Requirements")}:
            </p>
            <ul className="text-xs space-y-1">
              <li className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-emerald-500" />
                {config.minSales}+ {t("creator.sales", "sales")}
              </li>
              <li className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-emerald-500" />
                {config.minTemplates}+ {t("creator.templates", "templates")}
              </li>
            </ul>
            <p className="text-xs text-muted-foreground font-medium">
              {t("creator.tierBenefits", "Benefits")}:
            </p>
            <ul className="text-xs space-y-1">
              {config.benefits.slice(0, 4).map((benefit, i) => (
                <li key={i} className="flex items-start gap-1">
                  <span className="text-primary">-</span>
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function CreatorTierWithProgress({
  tier,
  currentSales,
  currentTemplates,
  showProgress = true,
  ...props
}: CreatorTierWithProgressProps) {
  const { t } = useTranslation();
  const config = TIER_CONFIG[tier];

  const salesProgress = Math.min((currentSales / config.minSales) * 100, 100);
  const templatesProgress = Math.min((currentTemplates / config.minTemplates) * 100, 100);

  // Determine next tier
  const tiers: CreatorTier[] = ["bronze", "silver", "gold", "platinum", "diamond", "legend"];
  const currentIndex = tiers.indexOf(tier);
  const nextTier = currentIndex < tiers.length - 1 ? tiers[currentIndex + 1] : null;
  const nextConfig = nextTier ? TIER_CONFIG[nextTier] : null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-flex flex-col gap-1">
            <CreatorTierBadge tier={tier} {...props} />
            {showProgress && nextConfig && (
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-300"
                    style={{ width: `${salesProgress}%` }}
                  />
                </div>
                <span>
                  {currentSales}/{nextConfig.minSales} {t("creator.sales", "sales")}
                </span>
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-3">
            {/* Current Tier Info */}
            <div className="flex items-center gap-2">
              <div className={cn("p-1.5 rounded-lg", config.bgColor)}>
                <config.icon className={cn("h-4 w-4", config.color)} />
              </div>
              <div>
                <p className="font-semibold">{config.name} Creator</p>
                <p className="text-xs text-muted-foreground">
                  {currentSales} {t("creator.sales", "sales")} · {currentTemplates} {t("creator.templates", "templates")}
                </p>
              </div>
            </div>

            {/* Progress to Next Tier */}
            {nextConfig && (
              <div className="space-y-2">
                <p className="text-xs font-medium">
                  {t("creator.progressToNext", "Progress to {{tier}}", { tier: nextConfig.name })}
                </p>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span>{t("creator.sales", "Sales")}</span>
                    <span className="text-muted-foreground">
                      {currentSales}/{nextConfig.minSales}
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-300"
                      style={{ width: `${salesProgress}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span>{t("creator.templates", "Templates")}</span>
                    <span className="text-muted-foreground">
                      {currentTemplates}/{nextConfig.minTemplates}
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-300"
                      style={{ width: `${templatesProgress}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Benefits */}
            <div>
              <p className="text-xs font-medium mb-1.5">
                {t("creator.currentBenefits", "Current Benefits")}
              </p>
              <ul className="text-xs space-y-1">
                {config.benefits.map((benefit, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <CheckCircle className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface CreatorProfileHeaderProps {
  creatorName: string;
  creatorAvatarUrl?: string | null;
  tier: CreatorTier;
  totalSales: number;
  totalTemplates: number;
  className?: string;
}

export function CreatorProfileHeader({
  creatorName,
  creatorAvatarUrl,
  tier,
  totalSales,
  totalTemplates,
  className,
}: CreatorProfileHeaderProps) {
  const { t } = useTranslation();
  const config = TIER_CONFIG[tier];

  return (
    <div className={cn("flex items-center gap-4 p-4 rounded-lg bg-muted/50", className)}>
      <div className="relative">
        <Avatar className="h-16 w-16 border-2 border-background">
          <AvatarImage src={creatorAvatarUrl ?? undefined} />
          <AvatarFallback className="text-xl">
            {creatorName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className={cn(
          "absolute -bottom-1 -right-1 p-1 rounded-full border-2 border-background",
          config.bgColor
        )}>
          <config.icon className={cn("h-3.5 w-3.5", config.color)} />
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-semibold text-lg">{creatorName}</h3>
          <CreatorTierBadge tier={tier} size="sm" />
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>
            <strong className="text-foreground">{totalTemplates}</strong>{" "}
            {t("creator.templates", "templates")}
          </span>
          <span>
            <strong className="text-foreground">{totalSales}</strong>{" "}
            {t("creator.sales", "sales")}
          </span>
        </div>
      </div>
    </div>
  );
}

export { TIER_CONFIG };
export type { CreatorTierConfig };
