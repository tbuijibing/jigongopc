import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Star, SlidersHorizontal, X } from "lucide-react";

export interface TemplateFiltersState {
  priceRange: [number, number];
  categories: string[];
  minRating: number;
  sortBy: string;
  sortOrder: "asc" | "desc";
}

const SORT_OPTIONS = [
  { value: "popular", label: "templateStore.mostPopular" },
  { value: "newest", label: "templateStore.newest" },
  { value: "rating", label: "templateStore.highestRated" },
  { value: "price_asc", label: "templateStore.priceLowToHigh" },
  { value: "price_desc", label: "templateStore.priceHighToLow" },
];

const RATING_OPTIONS = [
  { value: 0, label: "templateStore.allRatings" },
  { value: 4, label: "4+ stars" },
  { value: 3, label: "3+ stars" },
  { value: 2, label: "2+ stars" },
];

interface TemplateFiltersProps {
  categories: string[];
  filters: TemplateFiltersState;
  onFiltersChange: (filters: TemplateFiltersState) => void;
  onApply?: () => void;
  onClear?: () => void;
  className?: string;
  variant?: "sidebar" | "drawer" | "inline";
}

export function TemplateFilters({
  categories,
  filters,
  onFiltersChange,
  onApply,
  onClear,
  className,
  variant = "sidebar",
}: TemplateFiltersProps) {
  const { t } = useTranslation();
  const [localPriceRange, setLocalPriceRange] = useState<[number, number]>(filters.priceRange);

  const updateFilters = useCallback(
    (updates: Partial<TemplateFiltersState>) => {
      onFiltersChange({ ...filters, ...updates });
    },
    [filters, onFiltersChange]
  );

  const handleCategoryToggle = useCallback(
    (category: string) => {
      const newCategories = filters.categories.includes(category)
        ? filters.categories.filter((c) => c !== category)
        : [...filters.categories, category];
      updateFilters({ categories: newCategories });
    },
    [filters.categories, updateFilters]
  );

  const handlePriceRangeChange = useCallback(
    (index: number, value: number) => {
      const newRange: [number, number] = [...localPriceRange] as [number, number];
      newRange[index] = value;
      if (index === 0 && value > newRange[1]) {
        newRange[1] = value;
      }
      if (index === 1 && value < newRange[0]) {
        newRange[0] = value;
      }
      setLocalPriceRange(newRange);
      updateFilters({ priceRange: newRange });
    },
    [localPriceRange, updateFilters]
  );

  const hasActiveFilters =
    filters.categories.length > 0 ||
    filters.minRating > 0 ||
    filters.priceRange[0] > 0 ||
    filters.priceRange[1] < 10000;

  const activeFilterCount =
    filters.categories.length +
    (filters.minRating > 0 ? 1 : 0) +
    (filters.priceRange[0] > 0 || filters.priceRange[1] < 10000 ? 1 : 0);

  const FilterSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="space-y-3">
      <h4 className="font-medium text-sm">{title}</h4>
      {children}
    </div>
  );

  const PriceRangeSlider = () => {
    const minPrice = 0;
    const maxPrice = 10000;
    const step = 100;

    const formatPrice = (cents: number) => {
      if (cents === 0) return t("templateStore.free", "Free");
      if (cents >= 10000) return "$100+";
      return `$${(cents / 100).toFixed(0)}`;
    };

    return (
      <div className="space-y-4">
        {/* Range inputs */}
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground mb-1.5 block">
              {t("common.min", "Min")}
            </Label>
            <input
              type="number"
              min={minPrice}
              max={maxPrice}
              step={step}
              value={localPriceRange[0]}
              onChange={(e) => handlePriceRangeChange(0, parseInt(e.target.value) || 0)}
              className={cn(
                "w-full h-9 px-3 rounded-md border bg-transparent text-sm",
                "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0",
                "disabled:cursor-not-allowed disabled:opacity-50"
              )}
              placeholder="0"
            />
          </div>
          <span className="text-muted-foreground mt-6">-</span>
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground mb-1.5 block">
              {t("common.max", "Max")}
            </Label>
            <input
              type="number"
              min={minPrice}
              max={maxPrice}
              step={step}
              value={localPriceRange[1]}
              onChange={(e) => handlePriceRangeChange(1, parseInt(e.target.value) || maxPrice)}
              className={cn(
                "w-full h-9 px-3 rounded-md border bg-transparent text-sm",
                "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0",
                "disabled:cursor-not-allowed disabled:opacity-50"
              )}
              placeholder="∞"
            />
          </div>
        </div>

        {/* Visual slider track */}
        <div className="relative h-2 bg-muted rounded-full">
          <div
            className="absolute h-full bg-primary rounded-full"
            style={{
              left: `${(localPriceRange[0] / maxPrice) * 100}%`,
              right: `${100 - (localPriceRange[1] / maxPrice) * 100}%`,
            }}
          />
          {/* Min handle */}
          <input
            type="range"
            min={minPrice}
            max={maxPrice}
            step={step}
            value={localPriceRange[0]}
            onChange={(e) => handlePriceRangeChange(0, parseInt(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            style={{ zIndex: 1 }}
          />
          {/* Max handle */}
          <input
            type="range"
            min={minPrice}
            max={maxPrice}
            step={step}
            value={localPriceRange[1]}
            onChange={(e) => handlePriceRangeChange(1, parseInt(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            style={{ zIndex: 2 }}
          />
        </div>

        {/* Price labels */}
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{formatPrice(localPriceRange[0])}</span>
          <span>{formatPrice(localPriceRange[1])}</span>
        </div>
      </div>
    );
  };

  const RatingSelector = () => (
    <div className="space-y-2">
      {RATING_OPTIONS.map((option) => (
        <button
          key={option.value}
          onClick={() => updateFilters({ minRating: option.value })}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
            filters.minRating === option.value
              ? "bg-primary/10 text-primary"
              : "hover:bg-accent"
          )}
        >
          {option.value === 0 ? (
            <span className="flex-1 text-left">{t(option.label)}</span>
          ) : (
            <>
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={cn(
                      "h-3.5 w-3.5",
                      i < option.value
                        ? "fill-amber-400 text-amber-400"
                        : "text-muted-foreground/30"
                    )}
                  />
                ))}
              </div>
              <span className="flex-1 text-left">{option.label}</span>
            </>
          )}
          {filters.minRating === option.value && (
            <div className="h-2 w-2 rounded-full bg-primary" />
          )}
        </button>
      ))}
    </div>
  );

  const CategoryCheckboxes = () => (
    <ScrollArea className="h-48">
      <div className="space-y-2 pr-4">
        {categories.map((category) => (
          <div
            key={category}
            className="flex items-center gap-2 hover:bg-accent/50 rounded-md px-2 py-1.5 transition-colors"
          >
            <Checkbox
              id={`category-${category}`}
              checked={filters.categories.includes(category)}
              onCheckedChange={() => handleCategoryToggle(category)}
            />
            <Label
              htmlFor={`category-${category}`}
              className="text-sm font-normal cursor-pointer flex-1"
            >
              {category}
            </Label>
          </div>
        ))}
      </div>
    </ScrollArea>
  );

  const SortDropdown = () => (
    <Select
      value={filters.sortBy}
      onValueChange={(value) => updateFilters({ sortBy: value })}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder={t("templateStore.sortBy", "Sort by")} />
      </SelectTrigger>
      <SelectContent>
        {SORT_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {t(option.label)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const ClearButton = () => (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        onClear?.();
        setLocalPriceRange([0, 10000]);
      }}
      disabled={!hasActiveFilters}
      className="text-muted-foreground hover:text-foreground"
    >
      <X className="h-4 w-4 mr-1" />
      {t("common.clearAll", "Clear all")}
    </Button>
  );

  if (variant === "inline") {
    return (
      <div className={cn("flex flex-wrap items-center gap-4", className)}>
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <SortDropdown />
        </div>

        <Separator orientation="vertical" className="h-6" />

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{t("templateStore.price", "Price")}:</span>
          <Select
            value={`${localPriceRange[0]}-${localPriceRange[1]}`}
            onValueChange={(value) => {
              const [min, max] = value.split("-").map(Number);
              setLocalPriceRange([min, max]);
              updateFilters({ priceRange: [min, max] });
            }}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0-10000">{t("templateStore.allPrices", "All")}</SelectItem>
              <SelectItem value="0-0">{t("templateStore.free", "Free")}</SelectItem>
              <SelectItem value="1-10000">{t("templateStore.paid", "Paid")}</SelectItem>
              <SelectItem value="0-500">Under $5</SelectItem>
              <SelectItem value="500-1000">$5 - $10</SelectItem>
              <SelectItem value="1000-5000">$10 - $50</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-muted-foreground" />
          <Select
            value={String(filters.minRating)}
            onValueChange={(value) => updateFilters({ minRating: Number(value) })}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RATING_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={String(option.value)}>
                  {option.value === 0 ? t(option.label) : option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {hasActiveFilters && <ClearButton />}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "space-y-6",
        variant === "sidebar" && "w-64 p-4 bg-card rounded-lg border",
        variant === "drawer" && "w-full space-y-6",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4" />
          <h3 className="font-semibold">{t("templateStore.filters", "Filters")}</h3>
        </div>
        {activeFilterCount > 0 && (
          <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
            {activeFilterCount}
          </span>
        )}
      </div>

      <Separator />

      {/* Sort */}
      <FilterSection title={t("templateStore.sortBy", "Sort by")}>
        <SortDropdown />
      </FilterSection>

      <Separator />

      {/* Price Range */}
      <FilterSection title={t("templateStore.price", "Price Range")}>
        <PriceRangeSlider />
      </FilterSection>

      <Separator />

      {/* Rating */}
      <FilterSection title={t("templateStore.rating", "Rating")}>
        <RatingSelector />
      </FilterSection>

      <Separator />

      {/* Categories */}
      <FilterSection title={t("templateStore.categories", "Categories")}>
        <CategoryCheckboxes />
      </FilterSection>

      <Separator />

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          variant="default"
          className="flex-1"
          onClick={onApply}
        >
          {t("common.apply", "Apply")}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            onClear?.();
            setLocalPriceRange([0, 10000]);
          }}
          disabled={!hasActiveFilters}
        >
          {t("common.clear", "Clear")}
        </Button>
      </div>
    </div>
  );
}
