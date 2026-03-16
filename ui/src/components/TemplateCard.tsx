import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn, formatCents } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Star,
  Download,
  Check,
  Zap,
  TrendingUp,
  ExternalLink,
} from "lucide-react";

export interface Template {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  authorName: string;
  authorAvatarUrl?: string | null;
  rating: number;
  ratingCount: number;
  priceCents: number;
  installCount: number;
  category: string;
  isFeatured?: boolean;
  isNew?: boolean;
  isInstalled?: boolean;
}

interface TemplateCardProps {
  template: Template;
  variant?: "compact" | "detailed" | "featured";
  onInstall?: (template: Template) => void;
  onPurchase?: (template: Template) => void;
  onClick?: (template: Template) => void;
  className?: string;
}

export function TemplateCard({
  template,
  variant = "compact",
  onInstall,
  onPurchase,
  onClick,
  className,
}: TemplateCardProps) {
  const { t } = useTranslation();
  const [isHovered, setIsHovered] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  const isFree = template.priceCents === 0;
  const displayPrice = isFree
    ? t("templateStore.free", "Free")
    : formatCents(template.priceCents);

  const handleInstall = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onInstall || template.isInstalled) return;
    setIsInstalling(true);
    try {
      await onInstall(template);
    } finally {
      setIsInstalling(false);
    }
  };

  const handlePurchase = (e: React.MouseEvent) => {
    e.stopPropagation();
    onPurchase?.(template);
  };

  const handleClick = () => {
    onClick?.(template);
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5">
        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
        <span className="text-xs font-medium">{rating.toFixed(1)}</span>
      </div>
    );
  };

  const renderInstallCount = (count: number) => {
    return (
      <div className="flex items-center gap-1 text-muted-foreground">
        <Download className="h-3 w-3" />
        <span className="text-xs">
          {count >= 1000 ? `${(count / 1000).toFixed(1)}k` : count}
        </span>
      </div>
    );
  };

  // Compact variant - for grid view
  if (variant === "compact") {
    return (
      <TooltipProvider>
        <Card
          className={cn(
            "group relative overflow-hidden cursor-pointer transition-all duration-200",
            "hover:shadow-md hover:border-primary/20",
            template.isFeatured && "ring-1 ring-amber-500/20",
            className
          )}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={handleClick}
        >
          {/* Thumbnail */}
          <div className="relative aspect-video bg-muted overflow-hidden">
            {template.thumbnailUrl ? (
              <img
                src={template.thumbnailUrl}
                alt={template.name}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/5 to-primary/10">
                <Zap className="h-8 w-8 text-primary/30" />
              </div>
            )}

            {/* Badges */}
            <div className="absolute top-2 left-2 flex gap-1">
              {template.isNew && (
                <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-blue-500/10 text-blue-600 border-0">
                  {t("templateStore.new", "New")}
                </Badge>
              )}
              {template.isFeatured && (
                <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-amber-500/10 text-amber-600 border-0">
                  <TrendingUp className="h-3 w-3 mr-0.5" />
                  {t("templateStore.popular", "Popular")}
                </Badge>
              )}
            </div>

            {/* Price badge */}
            <div className="absolute top-2 right-2">
              <Badge
                variant={isFree ? "default" : "secondary"}
                className={cn(
                  "text-[10px] h-5 px-1.5",
                  isFree && "bg-emerald-500/10 text-emerald-600 border-0"
                )}
              >
                {displayPrice}
              </Badge>
            </div>

            {/* Hover overlay with quick actions */}
            {isHovered && !template.isInstalled && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center gap-2 animate-in fade-in duration-200">
                {isFree ? (
                  <Button
                    size="sm"
                    className="h-8"
                    onClick={handleInstall}
                    disabled={isInstalling}
                  >
                    {isInstalling ? (
                      <>
                        <div className="h-3 w-3 mr-1.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        {t("templateStore.installing", "Installing...")}
                      </>
                    ) : (
                      <>
                        <Download className="h-3.5 w-3.5 mr-1.5" />
                        {t("templateStore.install", "Install")}
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="h-8"
                    onClick={handlePurchase}
                  >
                    {t("templateStore.purchase", "Purchase")}
                  </Button>
                )}
              </div>
            )}

            {template.isInstalled && (
              <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center">
                <div className="bg-emerald-500 text-white rounded-full p-2">
                  <Check className="h-5 w-5" />
                </div>
              </div>
            )}
          </div>

          <CardContent className="p-3">
            <h3 className="font-medium text-sm line-clamp-1 mb-1">{template.name}</h3>

            <div className="flex items-center justify-between text-xs mb-2">
              <div className="flex items-center gap-1.5">
                <Avatar className="h-4 w-4">
                  <AvatarImage src={template.authorAvatarUrl ?? undefined} />
                  <AvatarFallback className="text-[8px]">
                    {template.authorName.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-muted-foreground truncate max-w-[80px]">
                  {template.authorName}
                </span>
              </div>
              <span className="text-muted-foreground">{template.category}</span>
            </div>

            <div className="flex items-center justify-between">
              {renderStars(template.rating)}
              {renderInstallCount(template.installCount)}
            </div>
          </CardContent>
        </Card>
      </TooltipProvider>
    );
  }

  // Detailed variant - for list view
  if (variant === "detailed") {
    return (
      <Card
        className={cn(
          "group cursor-pointer transition-all duration-200 hover:shadow-md",
          template.isFeatured && "ring-1 ring-amber-500/20",
          className
        )}
        onClick={handleClick}
      >
        <div className="flex gap-4 p-4">
          {/* Thumbnail */}
          <div className="relative w-32 h-20 rounded-md overflow-hidden bg-muted shrink-0">
            {template.thumbnailUrl ? (
              <img
                src={template.thumbnailUrl}
                alt={template.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/5 to-primary/10">
                <Zap className="h-6 w-6 text-primary/30" />
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold">{template.name}</h3>
                  {template.isNew && (
                    <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-blue-500/10 text-blue-600 border-0">
                      {t("templateStore.new", "New")}
                    </Badge>
                  )}
                  {template.isFeatured && (
                    <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-amber-500/10 text-amber-600 border-0">
                      <TrendingUp className="h-3 w-3 mr-0.5" />
                      {t("templateStore.popular", "Popular")}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                  {template.description || t("templateDetail.aboutTemplate", "No description available")}
                </p>

                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={template.authorAvatarUrl ?? undefined} />
                      <AvatarFallback className="text-[9px]">
                        {template.authorName.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span>{template.authorName}</span>
                  </div>
                  <span className="text-muted-foreground">{template.category}</span>
                  {renderStars(template.rating)}
                  <span className="text-muted-foreground">({template.ratingCount})</span>
                  {renderInstallCount(template.installCount)}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col items-end gap-2 shrink-0">
                <Badge
                  variant={isFree ? "default" : "secondary"}
                  className={cn(
                    isFree && "bg-emerald-500/10 text-emerald-600 border-0"
                  )}
                >
                  {displayPrice}
                </Badge>

                {template.isInstalled ? (
                  <Button variant="outline" size="sm" disabled className="gap-1.5">
                    <Check className="h-3.5 w-3.5" />
                    {t("templateDetail.installed", "Installed")}
                  </Button>
                ) : isFree ? (
                  <Button
                    size="sm"
                    onClick={handleInstall}
                    disabled={isInstalling}
                    className="gap-1.5"
                  >
                    {isInstalling ? (
                      <>
                        <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        {t("templateStore.installing", "Installing...")}
                      </>
                    ) : (
                      <>
                        <Download className="h-3.5 w-3.5" />
                        {t("templateStore.install", "Install")}
                      </>
                    )}
                  </Button>
                ) : (
                  <Button size="sm" onClick={handlePurchase} className="gap-1.5">
                    {t("templateStore.purchase", "Purchase")}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  // Featured variant - large card for hero section
  return (
    <Card
      className={cn(
        "group relative overflow-hidden cursor-pointer transition-all duration-200",
        "hover:shadow-lg hover:shadow-primary/5",
        "ring-1 ring-amber-500/20",
        className
      )}
      onClick={handleClick}
    >
      <div className="relative aspect-[2/1] overflow-hidden">
        {template.thumbnailUrl ? (
          <img
            src={template.thumbnailUrl}
            alt={template.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 via-primary/5 to-background">
            <Zap className="h-16 w-16 text-primary/20" />
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />

        {/* Featured badge */}
        <div className="absolute top-4 left-4">
          <Badge className="bg-amber-500 text-white border-0 gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" />
            {t("templateStore.featuredPremium", "Featured Premium")}
          </Badge>
        </div>

        {/* Content overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold mb-2">{template.name}</h2>
              <p className="text-muted-foreground line-clamp-2 mb-3 max-w-xl">
                {template.description}
              </p>

              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={template.authorAvatarUrl ?? undefined} />
                    <AvatarFallback className="text-[10px]">
                      {template.authorName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span>{template.authorName}</span>
                </div>
                <span className="text-muted-foreground">{template.category}</span>
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  <span className="font-medium">{template.rating.toFixed(1)}</span>
                  <span className="text-muted-foreground">({template.ratingCount})</span>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Download className="h-4 w-4" />
                  <span>{template.installCount >= 1000 ? `${(template.installCount / 1000).toFixed(1)}k` : template.installCount}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-3 shrink-0">
              <div className="text-2xl font-bold">
                {displayPrice}
              </div>

              {template.isInstalled ? (
                <Button variant="outline" disabled className="gap-2">
                  <Check className="h-4 w-4" />
                  {t("templateDetail.installed", "Installed")}
                </Button>
              ) : isFree ? (
                <Button
                  size="lg"
                  onClick={handleInstall}
                  disabled={isInstalling}
                  className="gap-2"
                >
                  {isInstalling ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      {t("templateStore.installing", "Installing...")}
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      {t("templateStore.install", "Install")}
                    </>
                  )}
                </Button>
              ) : (
                <Button size="lg" onClick={handlePurchase} className="gap-2">
                  {t("templateStore.purchase", "Purchase")}
                </Button>
              )}

              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClick();
                }}
              >
                {t("templateDetail.viewDetails", "View Details")}
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
