import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "@/lib/router";
import {
  agentSixDimensionApi,
  type CreatorRevenueSummary,
  type CompanyTemplate,
} from "../api/agent-six-dimensions";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useToast } from "../context/ToastContext";
import { queryKeys } from "../lib/queryKeys";
import { PageSkeleton } from "../components/PageSkeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DollarSign,
  TrendingUp,
  Wallet,
  Clock,
  Package,
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  Archive,
  Download,
  Star,
  ArrowUpRight,
  Medal,
  Crown,
  Gem,
  Award,
  ChevronRight,
  Loader2,
  CreditCard,
  Building2,
  AlertCircle,
} from "lucide-react";
import { formatCents, cn } from "../lib/utils";
import { EmptyState } from "../components/EmptyState";

// Mock data for withdrawal history - would come from API in real implementation
const MOCK_WITHDRAWAL_HISTORY = [
  {
    id: "wd-1",
    amountCents: 50000,
    method: "bank_transfer",
    status: "completed",
    requestedAt: "2026-02-15T10:30:00Z",
    completedAt: "2026-02-16T14:22:00Z",
  },
  {
    id: "wd-2",
    amountCents: 25000,
    method: "paypal",
    status: "completed",
    requestedAt: "2026-01-20T08:15:00Z",
    completedAt: "2026-01-21T11:45:00Z",
  },
  {
    id: "wd-3",
    amountCents: 100000,
    method: "bank_transfer",
    status: "pending",
    requestedAt: "2026-03-10T16:45:00Z",
    completedAt: null,
  },
];

// Mock monthly revenue data for chart
const MOCK_MONTHLY_REVENUE = [
  { month: "Mar 2025", amount: 15000 },
  { month: "Apr 2025", amount: 22000 },
  { month: "May 2025", amount: 18000 },
  { month: "Jun 2025", amount: 35000 },
  { month: "Jul 2025", amount: 42000 },
  { month: "Aug 2025", amount: 38000 },
  { month: "Sep 2025", amount: 55000 },
  { month: "Oct 2025", amount: 48000 },
  { month: "Nov 2025", amount: 62000 },
  { month: "Dec 2025", amount: 75000 },
  { month: "Jan 2026", amount: 58000 },
  { month: "Feb 2026", amount: 68000 },
];

const TIER_CONFIG = {
  bronze: {
    label: "Bronze",
    color: "bg-amber-700",
    textColor: "text-amber-700",
    borderColor: "border-amber-700",
    icon: Medal,
    nextTier: "silver",
    requirements: "$0 - $999 lifetime earnings",
    benefits: ["Standard payout schedule", "Email support", "Basic analytics"],
  },
  silver: {
    label: "Silver",
    color: "bg-slate-400",
    textColor: "text-slate-500",
    borderColor: "border-slate-400",
    icon: Award,
    nextTier: "gold",
    requirements: "$1,000 - $4,999 lifetime earnings",
    benefits: ["Faster payout schedule", "Priority email support", "Advanced analytics", "Featured creator badge"],
  },
  gold: {
    label: "Gold",
    color: "bg-yellow-500",
    textColor: "text-yellow-600",
    borderColor: "border-yellow-500",
    icon: Star,
    nextTier: "platinum",
    requirements: "$5,000 - $24,999 lifetime earnings",
    benefits: ["Express payouts", "Priority chat support", "Premium analytics", "Featured placement", "Early access to features"],
  },
  platinum: {
    label: "Platinum",
    color: "bg-cyan-500",
    textColor: "text-cyan-600",
    borderColor: "border-cyan-500",
    icon: Gem,
    nextTier: "diamond",
    requirements: "$25,000 - $99,999 lifetime earnings",
    benefits: ["Instant payouts", "Dedicated account manager", "Custom analytics", "Homepage feature", "Beta testing access"],
  },
  diamond: {
    label: "Diamond",
    color: "bg-purple-500",
    textColor: "text-purple-600",
    borderColor: "border-purple-500",
    icon: Crown,
    nextTier: null,
    requirements: "$100,000+ lifetime earnings",
    benefits: ["Instant payouts", "VIP support", "Custom integrations", "Strategic partnership", "Revenue sharing bonuses"],
  },
};

const PAYMENT_METHODS = [
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "paypal", label: "PayPal" },
  { value: "stripe", label: "Stripe" },
];

interface TemplateWithStats extends CompanyTemplate {
  totalRevenueCents: number;
  monthlyRevenueCents: number;
}

function RevenueChart({ data }: { data: typeof MOCK_MONTHLY_REVENUE }) {
  const maxValue = Math.max(...data.map((d) => d.amount));

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-1 h-32">
        {data.map((month, idx) => {
          const height = maxValue > 0 ? (month.amount / maxValue) * 100 : 0;
          return (
            <div
              key={idx}
              className="flex-1 flex flex-col items-center gap-1 group"
            >
              <div
                className="w-full bg-primary/20 rounded-t-sm relative overflow-hidden"
                style={{ height: `${Math.max(height, 4)}%` }}
              >
                <div
                  className="absolute bottom-0 left-0 right-0 bg-primary transition-all duration-300 group-hover:bg-primary/80"
                  style={{ height: "100%" }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{data[0]?.month}</span>
        <span>{data[data.length - 1]?.month}</span>
      </div>
    </div>
  );
}

function TierBadge({ tier }: { tier: keyof typeof TIER_CONFIG }) {
  const config = TIER_CONFIG[tier];
  const Icon = config.icon;

  return (
    <Badge
      className={cn(
        "text-white border-0",
        config.color
      )}
    >
      <Icon className="h-3 w-3 mr-1" />
      {config.label}
    </Badge>
  );
}

export function CreatorDashboard() {
  const { t } = useTranslation();
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isWithdrawDialogOpen, setIsWithdrawDialogOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawMethod, setWithdrawMethod] = useState("bank_transfer");
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    setBreadcrumbs([
      { label: t("templateStore.creatorCenter"), href: "/creator" },
      { label: t("creatorDashboard.title") },
    ]);
  }, [setBreadcrumbs, t]);

  const companyId = selectedCompanyId ?? "";

  const { data: revenue, isLoading: isRevenueLoading } = useQuery({
    queryKey: queryKeys.templates.creatorRevenue(companyId),
    queryFn: () => agentSixDimensionApi.getCreatorRevenue(companyId),
    enabled: !!companyId,
  });

  // Fetch creator's templates
  const { data: creatorTemplates, isLoading: isTemplatesLoading } = useQuery({
    queryKey: queryKeys.templates.installed(companyId),
    queryFn: () => agentSixDimensionApi.listInstalledTemplates(companyId),
    enabled: !!companyId,
  });

  const payoutMutation = useMutation({
    mutationFn: (data: { amountCents: number; method: string }) =>
      agentSixDimensionApi.requestPayout(companyId, data),
    onSuccess: () => {
      pushToast({
        title: t("creatorDashboard.withdrawalRequested"),
        tone: "success",
      });
      setIsWithdrawDialogOpen(false);
      setWithdrawAmount("");
      queryClient.invalidateQueries({
        queryKey: queryKeys.templates.creatorRevenue(companyId),
      });
    },
    onError: (err) => {
      pushToast({
        title: err instanceof Error ? err.message : t("creatorDashboard.withdrawalFailed"),
        tone: "error",
      });
    },
  });

  const handleWithdraw = () => {
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      pushToast({
        title: t("creatorDashboard.invalidAmount"),
        tone: "error",
      });
      return;
    }
    const amountCents = Math.round(amount * 100);
    if (revenue && amountCents > revenue.availableBalanceCents) {
      pushToast({
        title: t("creatorDashboard.insufficientBalance"),
        tone: "error",
      });
      return;
    }
    payoutMutation.mutate({ amountCents, method: withdrawMethod });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "published":
        return <Badge variant="default">{t("creatorDashboard.statusPublished")}</Badge>;
      case "draft":
        return <Badge variant="secondary">{t("creatorDashboard.statusDraft")}</Badge>;
      case "archived":
        return <Badge variant="outline">{t("creatorDashboard.statusArchived")}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const tierInfo = revenue ? TIER_CONFIG[revenue.tier] : TIER_CONFIG.bronze;
  const TierIcon = tierInfo.icon;

  // Calculate total monthly revenue from mock data
  const totalMonthlyRevenue = useMemo(() => {
    return MOCK_MONTHLY_REVENUE.reduce((sum, m) => sum + m.amount, 0);
  }, []);

  if (isRevenueLoading) {
    return <PageSkeleton variant="dashboard" />;
  }

  if (!revenue) {
    return (
      <EmptyState
        icon={Package}
        message={t("creatorDashboard.noData")}
        action={t("creatorDashboard.createFirstTemplate")}
        onAction={() => navigate("/templates/new")}
      />
    );
  }

  const templates = creatorTemplates?.templates ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("creatorDashboard.title")}</h1>
          <p className="text-muted-foreground">
            {t("creatorDashboard.description")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TierBadge tier={revenue.tier} />
          <Button onClick={() => navigate("/templates/new")}>
            <Plus className="h-4 w-4 mr-1.5" />
            {t("creatorDashboard.publishTemplate")}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="overview">
            <TrendingUp className="h-4 w-4 mr-1.5" />
            {t("creatorDashboard.tabs.overview")}
          </TabsTrigger>
          <TabsTrigger value="templates">
            <Package className="h-4 w-4 mr-1.5" />
            {t("creatorDashboard.tabs.templates")}
          </TabsTrigger>
          <TabsTrigger value="withdrawals">
            <Wallet className="h-4 w-4 mr-1.5" />
            {t("creatorDashboard.tabs.withdrawals")}
          </TabsTrigger>
          <TabsTrigger value="tier">
            <Crown className="h-4 w-4 mr-1.5" />
            {t("creatorDashboard.tabs.tier")}
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Revenue Stats Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t("creatorDashboard.totalRevenue")}
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCents(revenue.totalEarnedCents)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("creatorDashboard.lifetimeEarnings")}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t("creatorDashboard.availableBalance")}
                </CardTitle>
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCents(revenue.availableBalanceCents)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("creatorDashboard.readyToWithdraw")}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t("creatorDashboard.pendingSettlement")}
                </CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCents(revenue.pendingBalanceCents)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("creatorDashboard.pendingDescription")}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t("creatorDashboard.totalWithdrawn")}
                </CardTitle>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCents(revenue.totalWithdrawnCents)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("creatorDashboard.alreadyWithdrawn")}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Monthly Revenue Chart */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>{t("creatorDashboard.monthlyRevenue")}</CardTitle>
                <CardDescription>
                  {t("creatorDashboard.last12Months")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RevenueChart data={MOCK_MONTHLY_REVENUE} />
                <div className="mt-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {t("creatorDashboard.totalLast12Months")}
                    </p>
                    <p className="text-xl font-bold">
                      {formatCents(totalMonthlyRevenue)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">
                      {t("creatorDashboard.averageMonthly")}
                    </p>
                    <p className="text-xl font-bold">
                      {formatCents(Math.round(totalMonthlyRevenue / 12))}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions & Tier Status */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>{t("creatorDashboard.quickActions")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    className="w-full justify-between"
                    onClick={() => setIsWithdrawDialogOpen(true)}
                    disabled={revenue.availableBalanceCents <= 0}
                  >
                    <span className="flex items-center">
                      <Wallet className="h-4 w-4 mr-2" />
                      {t("creatorDashboard.withdrawFunds")}
                    </span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-between"
                    onClick={() => navigate("/templates/new")}
                  >
                    <span className="flex items-center">
                      <Plus className="h-4 w-4 mr-2" />
                      {t("creatorDashboard.publishNewTemplate")}
                    </span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-between"
                    onClick={() => setActiveTab("tier")}
                  >
                    <span className="flex items-center">
                      <Crown className="h-4 w-4 mr-2" />
                      {t("creatorDashboard.viewTierBenefits")}
                    </span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t("creatorDashboard.tierStatus")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-lg", tierInfo.color, "text-white")}>
                      <TierIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">{tierInfo.label} {t("creatorDashboard.tier")}</p>
                      <p className="text-sm text-muted-foreground">
                        {revenue.tierProgress.next > 0
                          ? t("creatorDashboard.progressToNext", {
                              current: formatCents(revenue.tierProgress.current),
                              next: formatCents(revenue.tierProgress.next),
                            })
                          : t("creatorDashboard.highestTier")}
                      </p>
                    </div>
                  </div>
                  {revenue.tierProgress.next > 0 && (
                    <div className="space-y-2">
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn("h-full transition-all", tierInfo.color)}
                          style={{ width: `${revenue.tierProgress.percentage}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground text-center">
                        {revenue.tierProgress.percentage.toFixed(0)}% {t("creatorDashboard.toNextTier")}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Top Performing Templates */}
          {templates.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t("creatorDashboard.topTemplates")}</CardTitle>
                <CardDescription>
                  {t("creatorDashboard.topTemplatesDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {templates.slice(0, 3).map((template) => (
                    <div
                      key={template.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                      onClick={() => navigate(`/templates/${template.id}`)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Package className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{template.name}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Download className="h-3 w-3" />
                              {template.installCount}
                            </span>
                            {template.rating && (
                              <span className="flex items-center gap-1">
                                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                {template.rating.toFixed(1)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">
                          {formatCents(template.priceCents * template.installCount)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t("creatorDashboard.totalRevenue")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {t("creatorDashboard.yourTemplates")}
            </h2>
            <Button onClick={() => navigate("/templates/new")}>
              <Plus className="h-4 w-4 mr-1.5" />
              {t("creatorDashboard.publishNew")}
            </Button>
          </div>

          {templates.length === 0 ? (
            <EmptyState
              icon={Package}
              message={t("creatorDashboard.noTemplates")}
              action={t("creatorDashboard.createFirstTemplate")}
              onAction={() => navigate("/templates/new")}
            />
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("creatorDashboard.templateName")}</TableHead>
                    <TableHead>{t("creatorDashboard.status")}</TableHead>
                    <TableHead className="text-right">{t("creatorDashboard.installs")}</TableHead>
                    <TableHead className="text-right">{t("creatorDashboard.revenue")}</TableHead>
                    <TableHead className="text-right">{t("creatorDashboard.rating")}</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{template.name}</p>
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {template.description || "-"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(template.isPublic ? "published" : "draft")}
                      </TableCell>
                      <TableCell className="text-right">
                        {template.installCount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCents(template.priceCents * template.installCount)}
                      </TableCell>
                      <TableCell className="text-right">
                        {template.rating ? (
                          <span className="flex items-center justify-end gap-1">
                            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                            {template.rating.toFixed(1)}
                          </span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/templates/${template.id}`)}>
                              <Edit className="h-4 w-4 mr-2" />
                              {t("common.edit")}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                agentSixDimensionApi.publishTemplate(
                                  companyId,
                                  template.id,
                                  !template.isPublic
                                );
                              }}
                            >
                              {template.isPublic ? (
                                <>
                                  <Archive className="h-4 w-4 mr-2" />
                                  {t("creatorDashboard.unpublish")}
                                </>
                              ) : (
                                <>
                                  <ArrowUpRight className="h-4 w-4 mr-2" />
                                  {t("creatorDashboard.publish")}
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => {
                                // Would show confirmation dialog in real implementation
                                pushToast({
                                  title: t("creatorDashboard.deleteComingSoon"),
                                  tone: "info",
                                });
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              {t("common.delete")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        {/* Withdrawals Tab */}
        <TabsContent value="withdrawals" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Withdrawal Form */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>{t("creatorDashboard.requestWithdrawal")}</CardTitle>
                <CardDescription>
                  {t("creatorDashboard.withdrawalDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="p-4 rounded-lg bg-muted">
                    <p className="text-sm text-muted-foreground">
                      {t("creatorDashboard.availableBalance")}
                    </p>
                    <p className="text-xl font-bold">
                      {formatCents(revenue.availableBalanceCents)}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted">
                    <p className="text-sm text-muted-foreground">
                      {t("creatorDashboard.minimumWithdrawal")}
                    </p>
                    <p className="text-xl font-bold">{formatCents(1000)}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted">
                    <p className="text-sm text-muted-foreground">
                      {t("creatorDashboard.processingTime")}
                    </p>
                    <p className="text-xl font-bold">3-5 {t("creatorDashboard.days")}</p>
                  </div>
                </div>

                <Separator />

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="amount">
                      {t("creatorDashboard.withdrawalAmount")}
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        $
                      </span>
                      <Input
                        id="amount"
                        type="number"
                        placeholder="0.00"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        className="pl-7"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("creatorDashboard.paymentMethod")}</Label>
                    <Select value={withdrawMethod} onValueChange={setWithdrawMethod}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHODS.map((method) => (
                          <SelectItem key={method.value} value={method.value}>
                            {method.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button
                  onClick={() => setIsWithdrawDialogOpen(true)}
                  disabled={revenue.availableBalanceCents < 1000}
                  className="w-full sm:w-auto"
                >
                  <Wallet className="h-4 w-4 mr-2" />
                  {t("creatorDashboard.requestWithdrawal")}
                </Button>

                {revenue.availableBalanceCents < 1000 && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <AlertCircle className="h-4 w-4" />
                    <span>{t("creatorDashboard.minimumBalanceRequired")}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Payment Methods */}
            <Card>
              <CardHeader>
                <CardTitle>{t("creatorDashboard.paymentMethods")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="font-medium">{t("creatorDashboard.bankTransfer")}</p>
                    <p className="text-sm text-muted-foreground">
                      ****1234
                    </p>
                  </div>
                  <Badge variant="default">{t("creatorDashboard.default")}</Badge>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="font-medium">PayPal</p>
                    <p className="text-sm text-muted-foreground">
                      creator@example.com
                    </p>
                  </div>
                </div>
                <Button variant="outline" className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  {t("creatorDashboard.addPaymentMethod")}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Withdrawal History */}
          <Card>
            <CardHeader>
              <CardTitle>{t("creatorDashboard.withdrawalHistory")}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("creatorDashboard.date")}</TableHead>
                    <TableHead>{t("creatorDashboard.amount")}</TableHead>
                    <TableHead>{t("creatorDashboard.method")}</TableHead>
                    <TableHead>{t("creatorDashboard.status")}</TableHead>
                    <TableHead>{t("creatorDashboard.completed")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {MOCK_WITHDRAWAL_HISTORY.map((withdrawal) => (
                    <TableRow key={withdrawal.id}>
                      <TableCell>{formatDate(withdrawal.requestedAt)}</TableCell>
                      <TableCell className="font-medium">
                        {formatCents(withdrawal.amountCents)}
                      </TableCell>
                      <TableCell>
                        {PAYMENT_METHODS.find((m) => m.value === withdrawal.method)?.label}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            withdrawal.status === "completed" ? "default" : "secondary"
                          }
                        >
                          {withdrawal.status === "completed"
                            ? t("creatorDashboard.statusCompleted")
                            : t("creatorDashboard.statusPending")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {withdrawal.completedAt
                          ? formatDate(withdrawal.completedAt)
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tier Tab */}
        <TabsContent value="tier" className="space-y-6">
          {/* Current Tier Card */}
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row md:items-center gap-6">
                <div
                  className={cn(
                    "w-24 h-24 rounded-2xl flex items-center justify-center",
                    tierInfo.color,
                    "text-white"
                  )}
                >
                  <TierIcon className="h-12 w-12" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-2xl font-bold">
                      {tierInfo.label} {t("creatorDashboard.tier")}
                    </h2>
                    <TierBadge tier={revenue.tier} />
                  </div>
                  <p className="text-muted-foreground mb-4">
                    {tierInfo.requirements}
                  </p>
                  {revenue.tierProgress.next > 0 && (
                    <div className="space-y-2 max-w-md">
                      <div className="flex justify-between text-sm">
                        <span>{t("creatorDashboard.progress")}</span>
                        <span>{revenue.tierProgress.percentage.toFixed(0)}%</span>
                      </div>
                      <div className="h-3 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn("h-full transition-all", tierInfo.color)}
                          style={{ width: `${revenue.tierProgress.percentage}%` }}
                        />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {t("creatorDashboard.earnMore", {
                          amount: formatCents(revenue.tierProgress.next - revenue.tierProgress.current),
                          tier: TIER_CONFIG[tierInfo.nextTier! as keyof typeof TIER_CONFIG]?.label ?? "Next Tier",
                        })}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tier Benefits */}
          <Card>
            <CardHeader>
              <CardTitle>{t("creatorDashboard.yourBenefits")}</CardTitle>
              <CardDescription>
                {t("creatorDashboard.benefitsDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                {tierInfo.benefits.map((benefit, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 p-4 rounded-lg bg-muted/50"
                  >
                    <div
                      className={cn(
                        "h-8 w-8 rounded-full flex items-center justify-center",
                        tierInfo.color,
                        "text-white"
                      )}
                    >
                      <Star className="h-4 w-4" />
                    </div>
                    <span>{benefit}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* All Tiers */}
          <Card>
            <CardHeader>
              <CardTitle>{t("creatorDashboard.allTiers")}</CardTitle>
              <CardDescription>
                {t("creatorDashboard.allTiersDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(TIER_CONFIG).map(([key, config]) => {
                  const isCurrentTier = key === revenue.tier;
                  const Icon = config.icon;
                  return (
                    <div
                      key={key}
                      className={cn(
                        "flex items-center gap-4 p-4 rounded-lg border-2 transition-colors",
                        isCurrentTier
                          ? cn(config.borderColor, "bg-primary/5")
                          : "border-transparent bg-muted/50"
                      )}
                    >
                      <div
                        className={cn(
                          "h-10 w-10 rounded-lg flex items-center justify-center",
                          config.color,
                          "text-white"
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{config.label}</span>
                          {isCurrentTier && (
                            <Badge variant="default">
                              {t("creatorDashboard.current")}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {config.requirements}
                        </p>
                      </div>
                      {config.nextTier && (
                        <div className="hidden sm:block text-right">
                          <p className="text-sm text-muted-foreground">
                            {t("creatorDashboard.nextBenefits")}
                          </p>
                          <p className="text-sm">{TIER_CONFIG[config.nextTier as keyof typeof TIER_CONFIG]?.benefits.length ?? 0} {t("creatorDashboard.benefits")}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Withdrawal Confirmation Dialog */}
      <Dialog open={isWithdrawDialogOpen} onOpenChange={setIsWithdrawDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("creatorDashboard.confirmWithdrawal")}</DialogTitle>
            <DialogDescription>
              {t("creatorDashboard.confirmWithdrawalDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-lg bg-muted p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {t("creatorDashboard.amount")}
                </span>
                <span className="font-medium">
                  ${parseFloat(withdrawAmount || "0").toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {t("creatorDashboard.method")}
                </span>
                <span className="font-medium">
                  {PAYMENT_METHODS.find((m) => m.value === withdrawMethod)?.label}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t("creatorDashboard.total")}
                </span>
                <span className="font-bold">
                  ${parseFloat(withdrawAmount || "0").toFixed(2)}
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setIsWithdrawDialogOpen(false)}
              className="flex-1"
            >
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleWithdraw}
              disabled={payoutMutation.isPending}
              className="flex-1"
            >
              {payoutMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {t("creatorDashboard.confirm")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
