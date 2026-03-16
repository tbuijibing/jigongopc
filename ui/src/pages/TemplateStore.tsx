import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@/lib/router";
import { useTranslation } from "react-i18next";
import {
  agentSixDimensionApi,
  type CompanyTemplate,
} from "../api/agent-six-dimensions";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { PageSkeleton } from "../components/PageSkeleton";
import { EmptyState } from "../components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Store,
  Search,
  Star,
  Download,
  User,
  Filter,
  Flame,
  Sparkles,
  Clock,
  TrendingUp,
  ChevronRight,
  LayoutGrid,
  Type,
  Cpu,
  Building2,
  Puzzle,
  Zap,
  ShoppingBag,
} from "lucide-react";

const TEMPLATE_CATEGORIES = [
  { value: "all", label: "All Templates", icon: LayoutGrid },
  { value: "workflow", label: "Workflow", icon: Zap },
  { value: "agent-config", label: "Agent Config", icon: Cpu },
  { value: "project-template", label: "Project Template", icon: Building2 },
  { value: "company-setup", label: "Company Setup", icon: Building2 },
  { value: "integration", label: "Integration", icon: Puzzle },
  { value: "automation", label: "Automation", icon: Sparkles },
] as const;

const SORT_OPTIONS = [
  { value: "popular", label: "Most Popular" },
  { value: "recent", label: "Newest" },
  { value: "rating", label: "Highest Rated" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
] as const;

const RATING_FILTERS = [
  { value: "all", label: "All Ratings" },
  { value: "4.5", label: "4.5+ Stars" },
  { value: "4.0", label: "4.0+ Stars" },
  { value: "3.0", label: "3.0+ Stars" },
] as const;

export function TemplateStore() {
  const { t } = useTranslation();
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState("popular");
  const [priceFilter, setPriceFilter] = useState<"all" | "free" | "paid">("all");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setBreadcrumbs([{ label: "Template Store" }]);
  }, [setBreadcrumbs]);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.templates.marketplace(selectedCompanyId!, {
      category: categoryFilter !== "all" ? categoryFilter : undefined,
      sort: sortBy,
      page,
      limit: 20,
    }),
    queryFn: () =>
      agentSixDimensionApi.listMarketplaceTemplates(selectedCompanyId!, {
        category: categoryFilter !== "all" ? categoryFilter : undefined,
        sort: sortBy,
        page,
        limit: 20,
      }),
    enabled: !!selectedCompanyId,
  });

  const searchResults = useQuery({
    queryKey: queryKeys.templates.search(selectedCompanyId!, searchQuery, {
      category: categoryFilter !== "all" ? categoryFilter : undefined,
      sort: sortBy,
    }),
    queryFn: () =>
      agentSixDimensionApi.searchMarketplace(selectedCompanyId!, searchQuery, {
        category: categoryFilter !== "all" ? categoryFilter : undefined,
        sort: sortBy,
      }),
    enabled: !!selectedCompanyId && searchQuery.trim().length > 0,
  });

  const templates = useMemo(() => {
    let result = searchQuery.trim()
      ? searchResults.data?.templates ?? []
      : data?.templates ?? [];

    if (priceFilter === "free") {
      result = result.filter((t) => t.priceCents === 0);
    } else if (priceFilter === "paid") {
      result = result.filter((t) => t.priceCents > 0);
    }

    if (ratingFilter !== "all") {
      const minRating = parseFloat(ratingFilter);
      result = result.filter((t) => (t.rating ?? 0) >= minRating);
    }

    return result;
  }, [data, searchResults.data, searchQuery, priceFilter, ratingFilter]);

  const total = searchQuery.trim() ? searchResults.data?.total : data?.total;

  // Derived template lists for sections
  const hotTemplates = useMemo(() => {
    const all = data?.templates ?? [];
    return all
      .filter((t) => t.installCount > 0)
      .sort((a, b) => b.installCount - a.installCount)
      .slice(0, 6);
  }, [data]);

  const featuredPaidTemplates = useMemo(() => {
    const all = data?.templates ?? [];
    return all
      .filter((t) => t.priceCents > 0)
      .sort((a, b) => b.priceCents - a.priceCents)
      .slice(0, 4);
  }, [data]);

  const latestTemplates = useMemo(() => {
    const all = data?.templates ?? [];
    return all
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 6);
  }, [data]);

  const handleTemplateClick = (template: CompanyTemplate) => {
    navigate(`/templates/${template.id}`);
  };

  const formatPrice = (cents: number) => {
    if (cents === 0) return "Free";
    return `$${(cents / 100).toFixed(2)}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  const clearFilters = () => {
    setSearchQuery("");
    setCategoryFilter("all");
    setPriceFilter("all");
    setRatingFilter("all");
    setSortBy("popular");
    setPage(1);
  };

  if (!selectedCompanyId) {
    return (
      <EmptyState
        icon={Store}
        message="Select a company to view the Template Store."
      />
    );
  }

  if (isLoading && !searchQuery) {
    return <PageSkeleton variant="list" />;
  }

  if (error) {
    return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  }

  const hasActiveFilters = searchQuery || categoryFilter !== "all" || priceFilter !== "all" || ratingFilter !== "all";

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-primary/20 p-6 sm:p-8">
        <div className="relative z-10">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Store className="h-6 w-6 text-primary" />
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Template Store
              </h1>
            </div>
            <p className="text-muted-foreground max-w-xl">
              Discover and install powerful templates to accelerate your agent workflows.
              From automation to integrations, find the perfect template for your needs.
            </p>
          </div>

          {/* Search Bar in Hero */}
          <div className="mt-6 max-w-2xl">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search templates by name, description, or author..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="pl-12 pr-4 py-6 text-base bg-background/80 backdrop-blur-sm border-primary/20 focus:border-primary"
              />
            </div>
          </div>

          {/* Quick Category Pills */}
          <div className="mt-4 flex flex-wrap gap-2">
            {TEMPLATE_CATEGORIES.slice(1, 5).map((cat) => {
              const Icon = cat.icon;
              return (
                <Button
                  key={cat.value}
                  variant={categoryFilter === cat.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCategoryFilter(cat.value === categoryFilter ? "all" : cat.value)}
                  className="gap-1.5"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {cat.label}
                </Button>
              );
            })}
          </div>
        </div>

        {/* Decorative Elements */}
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-20 w-32 h-32 bg-primary/5 rounded-full blur-2xl" />
      </div>

      {/* Main Content Layout */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar - Category Navigation */}
        <aside className="lg:w-64 space-y-6">
          {/* Categories */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <LayoutGrid className="h-4 w-4" />
              Categories
            </h3>
            <nav className="space-y-1">
              {TEMPLATE_CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const isActive = categoryFilter === cat.value;
                return (
                  <button
                    key={cat.value}
                    onClick={() => setCategoryFilter(cat.value)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-accent text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {cat.label}
                  </button>
                );
              })}
            </nav>
          </div>

          <Separator />

          {/* Price Filter */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <ShoppingBag className="h-4 w-4" />
              Price
            </h3>
            <div className="space-y-1">
              {["all", "free", "paid"].map((option) => (
                <button
                  key={option}
                  onClick={() => setPriceFilter(option as typeof priceFilter)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                    priceFilter === option
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent text-foreground"
                  }`}
                >
                  <span className="capitalize">{option}</span>
                  {priceFilter === option && <ChevronRight className="h-3 w-3" />}
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Rating Filter */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Star className="h-4 w-4" />
              Rating
            </h3>
            <Select value={ratingFilter} onValueChange={setRatingFilter}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RATING_FILTERS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Creator Center Link */}
          <Separator />
          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate("/creator")}
          >
            <User className="mr-2 h-4 w-4" />
            Creator Center
          </Button>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 space-y-8">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {templates.length} templates
              </span>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              )}
            </div>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Results Grid */}
          {searchResults.isLoading ? (
            <PageSkeleton variant="list" />
          ) : templates.length > 0 ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {templates.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    onClick={() => handleTemplateClick(template)}
                    formatPrice={formatPrice}
                  />
                ))}
              </div>

              {/* Pagination */}
              {total && total > 20 && !searchQuery && (
                <div className="flex items-center justify-center gap-2 pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {Math.ceil(total / 20)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= Math.ceil(total / 20)}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          ) : templates.length === 0 && hasActiveFilters ? (
            <EmptyState
              icon={Search}
              message="No templates match your filters."
              action="Clear filters"
              onAction={clearFilters}
            />
          ) : (
            /* Sections when no search/filter is active */
            <div className="space-y-10">
              {/* Hot Templates Section */}
              {hotTemplates.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <Flame className="h-5 w-5 text-orange-500" />
                    <h2 className="text-lg font-semibold">Hot Templates</h2>
                    <Badge variant="secondary" className="ml-2">
                      Popular
                    </Badge>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {hotTemplates.map((template) => (
                      <TemplateCard
                        key={template.id}
                        template={template}
                        onClick={() => handleTemplateClick(template)}
                        formatPrice={formatPrice}
                        showHotIndicator
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Featured Paid Templates */}
              {featuredPaidTemplates.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    <h2 className="text-lg font-semibold">Featured Premium</h2>
                    <Badge variant="default" className="ml-2">
                      Paid
                    </Badge>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {featuredPaidTemplates.map((template) => (
                      <TemplateCard
                        key={template.id}
                        template={template}
                        onClick={() => handleTemplateClick(template)}
                        formatPrice={formatPrice}
                        featured
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Latest Releases */}
              {latestTemplates.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <Clock className="h-5 w-5 text-blue-500" />
                    <h2 className="text-lg font-semibold">Latest Releases</h2>
                    <Badge variant="secondary" className="ml-2">
                      New
                    </Badge>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {latestTemplates.map((template) => (
                      <TemplateCard
                        key={template.id}
                        template={template}
                        onClick={() => handleTemplateClick(template)}
                        formatPrice={formatPrice}
                        showDate
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Empty State when no templates at all */}
              {hotTemplates.length === 0 && featuredPaidTemplates.length === 0 && latestTemplates.length === 0 && (
                <EmptyState
                  icon={Store}
                  message="No templates available yet."
                  action="Browse Creator Center"
                  onAction={() => navigate("/creator")}
                />
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// Template Card Component
interface TemplateCardProps {
  template: CompanyTemplate;
  onClick: () => void;
  formatPrice: (cents: number) => string;
  showHotIndicator?: boolean;
  showDate?: boolean;
  featured?: boolean;
}

function TemplateCard({
  template,
  onClick,
  formatPrice,
  showHotIndicator,
  showDate,
  featured,
}: TemplateCardProps) {
  return (
    <div
      onClick={onClick}
      className={`group cursor-pointer rounded-lg border bg-card p-4 transition-all hover:border-primary/50 hover:bg-accent/50 hover:shadow-sm ${
        featured ? "border-primary/30 bg-primary/5" : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium group-hover:text-primary truncate">
              {template.name}
            </h3>
            {showHotIndicator && template.installCount > 100 && (
              <Flame className="h-4 w-4 text-orange-500 shrink-0" />
            )}
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
            {template.description || "No description available"}
          </p>
        </div>
        <Badge
          variant={template.priceCents === 0 ? "secondary" : "default"}
          className="shrink-0"
        >
          {formatPrice(template.priceCents)}
        </Badge>
      </div>

      {/* Preview Placeholder */}
      <div className="mt-3 aspect-video rounded-md bg-muted flex items-center justify-center overflow-hidden">
        <div className="text-muted-foreground/50">
          <LayoutGrid className="h-8 w-8" />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
        {template.category && (
          <Badge variant="outline" className="text-xs">
            {template.category}
          </Badge>
        )}
        <div className="flex items-center gap-1">
          <Download className="h-3 w-3" />
          <span>{template.installCount}</span>
        </div>
        {template.rating && (
          <div className="flex items-center gap-1">
            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
            <span>{template.rating.toFixed(1)}</span>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
            {template.authorName?.charAt(0) || "?"}
          </div>
          <span className="text-xs text-muted-foreground truncate max-w-24">
            {template.authorName || "Unknown"}
          </span>
        </div>
        {showDate && (
          <span className="text-xs text-muted-foreground">
            {new Date(template.createdAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </span>
        )}
      </div>
    </div>
  );
}
