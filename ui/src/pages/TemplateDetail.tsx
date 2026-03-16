import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "@/lib/router";
import { useTranslation } from "react-i18next";
import {
  agentSixDimensionApi,
  type CompanyTemplateDetail,
  type CompanyTemplate,
} from "../api/agent-six-dimensions";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
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
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Store,
  Star,
  Download,
  User,
  GitFork,
  ArrowLeft,
  Package,
  FileText,
  DollarSign,
  CheckCircle,
  Loader2,
  ExternalLink,
  Clock,
  Shield,
  Eye,
  MessageSquare,
  ThumbsUp,
  Flag,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Sparkles,
  Zap,
  Share2,
  Heart,
} from "lucide-react";
import { useToast } from "../context/ToastContext";

const PAYMENT_METHODS = [
  { value: "balance", label: "Account Balance" },
  { value: "stripe", label: "Credit Card (Stripe)" },
  { value: "alipay", label: "Alipay" },
  { value: "wechat_pay", label: "WeChat Pay" },
] as const;

// Mock reviews data - in real implementation, this would come from API
const MOCK_REVIEWS = [
  {
    id: "1",
    userName: "Sarah Chen",
    avatar: "S",
    rating: 5,
    date: "2026-03-10T08:30:00Z",
    content: "Excellent template! Saved me hours of setup time. The documentation is clear and the integration was seamless.",
    helpful: 12,
  },
  {
    id: "2",
    userName: "Mike Johnson",
    avatar: "M",
    rating: 4,
    date: "2026-03-08T14:22:00Z",
    content: "Great template overall. Would love to see more customization options in future versions.",
    helpful: 8,
  },
  {
    id: "3",
    userName: "Emily Wang",
    avatar: "E",
    rating: 5,
    date: "2026-03-05T11:15:00Z",
    content: "Exactly what I needed for my project. The author was very responsive to questions.",
    helpful: 15,
  },
];

// Mock features data
const MOCK_FEATURES = [
  "Pre-configured agent workflows",
  "Integration with popular APIs",
  "Automated error handling",
  "Built-in monitoring and logging",
  "Customizable notification rules",
  "Multi-language support",
  "Role-based access control",
  "Backup and recovery options",
];

export function TemplateDetail() {
  const { t } = useTranslation();
  const { templateId } = useParams<{ templateId: string }>();
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const [isInstallDialogOpen, setIsInstallDialogOpen] = useState(false);
  const [isPurchaseDialogOpen, setIsPurchaseDialogOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("balance");
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [reviewText, setReviewText] = useState("");
  const [reviewRating, setReviewRating] = useState(5);

  useEffect(() => {
    setBreadcrumbs([
      { label: "Template Store", href: "/templates" },
      { label: "Template Details" },
    ]);
  }, [setBreadcrumbs]);

  const companyId = selectedCompanyId ?? "";
  const safeTemplateId = templateId ?? "";

  const { data: template, isLoading, error } = useQuery({
    queryKey: queryKeys.templates.detail(companyId, safeTemplateId),
    queryFn: () => agentSixDimensionApi.getMarketplaceTemplate(companyId, safeTemplateId, true),
    enabled: !!companyId && !!safeTemplateId,
  });

  // Fetch related templates
  const { data: relatedTemplates } = useQuery({
    queryKey: queryKeys.templates.marketplace(companyId, {
      category: template?.category,
      limit: 4,
    }),
    queryFn: () =>
      agentSixDimensionApi.listMarketplaceTemplates(companyId, {
        category: template?.category,
        limit: 4,
      }),
    enabled: !!companyId && !!template?.category,
  });

  const purchaseMutation = useMutation({
    mutationFn: (method: string) =>
      agentSixDimensionApi.purchaseTemplate(companyId, safeTemplateId, {
        paymentMethod: method,
      }),
    onSuccess: (result) => {
      pushToast({
        title: `Purchase successful! Transaction ID: ${result.transactionId}`,
        tone: "success",
      });
      setIsPurchaseDialogOpen(false);
      queryClient.invalidateQueries({
        queryKey: queryKeys.templates.detail(companyId, safeTemplateId),
      });
    },
    onError: (err) => {
      pushToast({
        title: err instanceof Error ? err.message : "Purchase failed",
        tone: "error",
      });
    },
  });

  const installMutation = useMutation({
    mutationFn: () =>
      agentSixDimensionApi.installTemplate(companyId, safeTemplateId, {
        targetCompanyId: companyId,
        customize: true,
      }),
    onSuccess: (result) => {
      pushToast({
        title: `Template installed successfully! Version: ${result.version}`,
        tone: "success",
      });
      setIsInstallDialogOpen(false);
      queryClient.invalidateQueries({
        queryKey: queryKeys.templates.installed(companyId),
      });
    },
    onError: (err) => {
      pushToast({
        title: err instanceof Error ? err.message : "Installation failed",
        tone: "error",
      });
    },
  });

  const forkMutation = useMutation({
    mutationFn: () =>
      agentSixDimensionApi.forkTemplate(companyId, safeTemplateId, {
        name: `${template?.name} (Fork)`,
      }),
    onSuccess: () => {
      pushToast({
        title: "Template forked successfully!",
        tone: "success",
      });
      navigate(`/templates`);
    },
    onError: (err) => {
      pushToast({
        title: err instanceof Error ? err.message : "Fork failed",
        tone: "error",
      });
    },
  });

  const formatPrice = (cents: number) => {
    if (cents === 0) return "Free";
    return `$${(cents / 100).toFixed(2)}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  const handleInstall = () => {
    if (template?.priceCents && template.priceCents > 0) {
      setIsPurchaseDialogOpen(true);
    } else {
      setIsInstallDialogOpen(true);
    }
  };

  const handlePurchaseAndInstall = () => {
    purchaseMutation.mutate(paymentMethod, {
      onSuccess: () => {
        setIsPurchaseDialogOpen(false);
        setIsInstallDialogOpen(true);
      },
    });
  };

  // Gallery images (mock data - in real app, would come from template)
  const galleryImages = template ? [
    { id: 0, alt: "Preview 1" },
    { id: 1, alt: "Preview 2" },
    { id: 2, alt: "Preview 3" },
    { id: 3, alt: "Preview 4" },
  ] : [];

  const handlePrevImage = () => {
    setActiveImageIndex((prev) => (prev === 0 ? galleryImages.length - 1 : prev - 1));
  };

  const handleNextImage = () => {
    setActiveImageIndex((prev) => (prev === galleryImages.length - 1 ? 0 : prev + 1));
  };

  const handleSubmitReview = () => {
    pushToast({
      title: "Review submitted successfully!",
      tone: "success",
    });
    setReviewText("");
    setReviewRating(5);
  };

  if (isLoading) {
    return <PageSkeleton variant="detail" />;
  }

  if (error || !template) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate("/templates")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Store
        </Button>
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : "Template not found"}
        </p>
      </div>
    );
  }

  const related = relatedTemplates?.templates?.filter((t) => t.id !== template.id).slice(0, 3) ?? [];

  return (
    <div className="space-y-6">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate("/templates")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Store
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsLiked(!isLiked)}
            className={isLiked ? "text-red-500" : ""}
          >
            <Heart className={`h-5 w-5 ${isLiked ? "fill-current" : ""}`} />
          </Button>
          <Button variant="ghost" size="icon">
            <Share2 className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Header Section */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Preview Gallery */}
        <div className="lg:w-96 space-y-3">
          <div className="aspect-video rounded-lg border border-border bg-muted flex items-center justify-center relative overflow-hidden group">
            <LayoutGrid className="h-16 w-16 text-muted-foreground/50" />
            {galleryImages.length > 1 && (
              <>
                <button
                  onClick={handlePrevImage}
                  className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={handleNextImage}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </>
            )}
            {template.isPublic && (
              <Badge className="absolute top-2 left-2" variant="default">
                <Eye className="h-3 w-3 mr-1" />
                Public
              </Badge>
            )}
          </div>
          {/* Thumbnail strip */}
          <div className="flex gap-2">
            {galleryImages.map((img, idx) => (
              <button
                key={img.id}
                onClick={() => setActiveImageIndex(idx)}
                className={`flex-1 aspect-video rounded-md border-2 flex items-center justify-center transition-colors ${
                  activeImageIndex === idx
                    ? "border-primary bg-primary/10"
                    : "border-border bg-muted hover:border-primary/50"
                }`}
              >
                <LayoutGrid className="h-6 w-6 text-muted-foreground/50" />
              </button>
            ))}
          </div>
        </div>

        {/* Info Section */}
        <div className="flex-1 space-y-4">
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold">{template.name}</h1>
                <p className="text-muted-foreground mt-1">
                  {template.description || "No description available"}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {template.rating && (
                  <div className="flex items-center gap-1 bg-yellow-50 dark:bg-yellow-950/50 px-2 py-1 rounded-md">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-semibold">{template.rating.toFixed(1)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                  {template.authorName?.charAt(0) || "?"}
                </div>
                <span>{template.authorName || "Unknown"}</span>
              </div>
              <Separator orientation="vertical" className="h-4" />
              <div className="flex items-center gap-1">
                <Download className="h-4 w-4" />
                <span>{template.installCount.toLocaleString()} installs</span>
              </div>
              <Separator orientation="vertical" className="h-4" />
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>Updated {formatDate(template.updatedAt)}</span>
              </div>
              <Separator orientation="vertical" className="h-4" />
              <Badge variant="outline">v{template.version}</Badge>
              {template.category && (
                <Badge variant="secondary">{template.category}</Badge>
              )}
            </div>
          </div>

          <Separator />

          {/* Price and Actions */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="text-3xl font-bold">
                {formatPrice(template.priceCents)}
              </div>
              {template.priceCents > 0 && (
                <p className="text-sm text-muted-foreground">
                  One-time purchase
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => forkMutation.mutate()}
                disabled={forkMutation.isPending}
              >
                <GitFork className="mr-2 h-4 w-4" />
                {forkMutation.isPending ? "Forking..." : "Fork"}
              </Button>
              <Button
                size="lg"
                onClick={handleInstall}
                disabled={installMutation.isPending}
              >
                {installMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Package className="mr-2 h-4 w-4" />
                )}
                {template.priceCents > 0 ? "Purchase & Install" : "Install"}
              </Button>
            </div>
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Shield className="h-4 w-4 text-green-500" />
              <span>Verified</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Secure payment</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-blue-500" />
              <span>Instant delivery</span>
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="overview">
            <Eye className="h-4 w-4 mr-1.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="features">
            <Zap className="h-4 w-4 mr-1.5" />
            Features
          </TabsTrigger>
          <TabsTrigger value="lineage">
            <GitFork className="h-4 w-4 mr-1.5" />
            Lineage
          </TabsTrigger>
          <TabsTrigger value="reviews">
            <MessageSquare className="h-4 w-4 mr-1.5" />
            Reviews
            <Badge variant="secondary" className="ml-1.5 text-xs">
              {MOCK_REVIEWS.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>About this template</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    {template.description || "No detailed description available."}
                  </p>
                  {template.content && (
                    <div className="mt-4">
                      <h4 className="font-medium mb-2">Template Content</h4>
                      <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-64">
                        {JSON.stringify(template.content, null, 2)}
                      </pre>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <Download className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                    <div className="text-2xl font-bold">{template.installCount}</div>
                    <div className="text-xs text-muted-foreground">Installs</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <Star className="h-5 w-5 mx-auto mb-1 text-yellow-500" />
                    <div className="text-2xl font-bold">
                      {template.rating?.toFixed(1) || "-"}
                    </div>
                    <div className="text-xs text-muted-foreground">Rating</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <GitFork className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                    <div className="text-2xl font-bold">
                      {template.lineage?.forks?.length || 0}
                    </div>
                    <div className="text-xs text-muted-foreground">Forks</div>
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Template Info</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Created</span>
                    <span>{formatDate(template.createdAt)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Updated</span>
                    <span>{formatDate(template.updatedAt)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Version</span>
                    <span>{template.version}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Slug</span>
                    <span className="font-mono text-xs">{template.slug}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Author</span>
                    <span>{template.authorName || "Unknown"}</span>
                  </div>
                </CardContent>
              </Card>

              {template.lineage?.forkedFrom && (
                <Card>
                  <CardHeader>
                    <CardTitle>Forked From</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Button
                      variant="link"
                      className="p-0 h-auto"
                      onClick={() =>
                        navigate(`/templates/${template.lineage?.forkedFrom}`)
                      }
                    >
                      {template.lineage.forkedFromName}
                      <ExternalLink className="ml-1 h-3 w-3" />
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="features" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Features & Capabilities</CardTitle>
              <CardDescription>
                Everything included in this template
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                {MOCK_FEATURES.map((feature, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                  >
                    <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
                    <span className="text-sm">{feature}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Version History</CardTitle>
            </CardHeader>
            <CardContent>
              {template.versions && template.versions.length > 0 ? (
                <div className="space-y-3">
                  {template.versions.map((version, index) => (
                    <div
                      key={version.version}
                      className={`flex items-start gap-3 p-3 rounded-lg ${
                        index === 0 ? "bg-primary/5 border border-primary/20" : "bg-muted/50"
                      }`}
                    >
                      <div className="mt-0.5">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">v{version.version}</span>
                          {index === 0 && (
                            <Badge variant="default">
                              Latest
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatDate(version.createdAt)}
                        </p>
                        {version.changeLog && (
                          <p className="text-sm mt-2">{version.changeLog}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No version history available
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lineage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Template Lineage</CardTitle>
              <CardDescription>
                Trace the origin and evolution of this template
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {template.lineage?.ancestorChain && template.lineage.ancestorChain.length > 0 ? (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Ancestors
                  </h4>
                  <div className="space-y-2">
                    {template.lineage.ancestorChain.map((ancestor) => (
                      <div
                        key={ancestor.id}
                        className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                      >
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{
                            backgroundColor:
                              ancestor.level === 0
                                ? "#10b981"
                                : ancestor.level === 1
                                  ? "#3b82f6"
                                  : "#6b7280",
                          }}
                        />
                        <span className="text-sm font-medium flex-1">
                          {ancestor.name}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          Level {ancestor.level}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No ancestors - this is an original template
                </p>
              )}

              {template.lineage?.forks && template.lineage.forks.length > 0 && (
                <div className="space-y-3">
                  <Separator />
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Forks ({template.lineage.forks.length})
                  </h4>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {template.lineage.forks.map((fork) => (
                      <div
                        key={fork.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      >
                        <span className="text-sm font-medium">{fork.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {fork.companyName}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(!template.lineage?.ancestorChain || template.lineage.ancestorChain.length === 0) &&
                (!template.lineage?.forks || template.lineage.forks.length === 0) && (
                <div className="text-center py-8">
                  <GitFork className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">
                    No lineage information available for this template
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reviews" className="space-y-4">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-4">
              {/* Reviews List */}
              {MOCK_REVIEWS.map((review) => (
                <Card key={review.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                        {review.avatar}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-medium">{review.userName}</span>
                            <div className="flex items-center gap-1 mt-0.5">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                  key={i}
                                  className={`h-3 w-3 ${
                                    i < review.rating
                                      ? "fill-yellow-400 text-yellow-400"
                                      : "text-muted-foreground"
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(review.date)}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">
                          {review.content}
                        </p>
                        <div className="flex items-center gap-4 mt-3">
                          <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                            <ThumbsUp className="h-3 w-3" />
                            Helpful ({review.helpful})
                          </button>
                          <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                            <Flag className="h-3 w-3" />
                            Report
                          </button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* Write Review */}
              <Card>
                <CardHeader>
                  <CardTitle>Write a Review</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Rating</Label>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setReviewRating(i + 1)}
                          className="p-1"
                        >
                          <Star
                            className={`h-6 w-6 ${
                              i < reviewRating
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-muted-foreground"
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Review</Label>
                    <Textarea
                      value={reviewText}
                      onChange={(e) => setReviewText(e.target.value)}
                      placeholder="Share your experience with this template..."
                      rows={4}
                    />
                  </div>
                  <Button onClick={handleSubmitReview} disabled={!reviewText.trim()}>
                    Submit Review
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Rating Summary */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Rating Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center">
                    <div className="text-4xl font-bold">
                      {template.rating?.toFixed(1) || "-"}
                    </div>
                    <div className="flex items-center justify-center gap-1 mt-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 ${
                            i < Math.round(template.rating || 0)
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-muted-foreground"
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {MOCK_REVIEWS.length} reviews
                    </p>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    {[
                      { stars: 5, count: 2 },
                      { stars: 4, count: 1 },
                      { stars: 3, count: 0 },
                      { stars: 2, count: 0 },
                      { stars: 1, count: 0 },
                    ].map((item) => (
                      <div key={item.stars} className="flex items-center gap-2">
                        <span className="text-xs w-3">{item.stars}</span>
                        <Star className="h-3 w-3 text-muted-foreground" />
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-yellow-400 rounded-full"
                            style={{
                              width: `${
                                MOCK_REVIEWS.length
                                  ? (item.count / MOCK_REVIEWS.length) * 100
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-6 text-right">
                          {item.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Related Templates */}
      {related.length > 0 && (
        <div className="space-y-4 pt-4">
          <Separator />
          <h2 className="text-lg font-semibold">Related Templates</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((relatedTemplate) => (
              <div
                key={relatedTemplate.id}
                onClick={() => navigate(`/templates/${relatedTemplate.id}`)}
                className="group cursor-pointer rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-accent/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <h3 className="font-medium group-hover:text-primary">
                      {relatedTemplate.name}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                      {relatedTemplate.description || "No description"}
                    </p>
                  </div>
                  <Badge
                    variant={relatedTemplate.priceCents === 0 ? "secondary" : "default"}
                  >
                    {formatPrice(relatedTemplate.priceCents)}
                  </Badge>
                </div>
                <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Download className="h-3 w-3" />
                    <span>{relatedTemplate.installCount}</span>
                  </div>
                  {relatedTemplate.rating && (
                    <div className="flex items-center gap-1">
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      <span>{relatedTemplate.rating.toFixed(1)}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Install Dialog */}
      <Dialog open={isInstallDialogOpen} onOpenChange={setIsInstallDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Install Template</DialogTitle>
            <DialogDescription>
              Install &quot;{template.name}&quot; to your company. You can customize it after
              installation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-lg bg-muted p-3">
              <div className="flex justify-between text-sm">
                <span>Template</span>
                <span className="font-medium">{template.name}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span>Version</span>
                <span className="font-medium">{template.version}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setIsInstallDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => installMutation.mutate()}
              disabled={installMutation.isPending}
              className="flex-1"
            >
              {installMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              <CheckCircle className="mr-2 h-4 w-4" />
              Confirm Installation
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Purchase Dialog */}
      <Dialog
        open={isPurchaseDialogOpen}
        onOpenChange={setIsPurchaseDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Purchase Template</DialogTitle>
            <DialogDescription>
              Complete your purchase of &quot;{template.name}&quot;
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-lg bg-muted p-4">
              <div className="flex justify-between items-center">
                <span className="font-medium">{template.name}</span>
                <span className="text-xl font-bold">
                  {formatPrice(template.priceCents)}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Payment Method</label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
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
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setIsPurchaseDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handlePurchaseAndInstall}
              disabled={purchaseMutation.isPending}
              className="flex-1"
            >
              {purchaseMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              <DollarSign className="mr-2 h-4 w-4" />
              Purchase & Install
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
