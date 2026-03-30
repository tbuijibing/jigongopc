import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { companiesApi } from "../api/companies";
import { useCompany } from "../context/CompanyContext";
import { queryKeys } from "../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircle, CheckCircle2, XCircle, Download, Upload, FileJson, Github, Link as LinkIcon, Eye, Loader2 } from "lucide-react";
import type {
  CompanyPortabilityManifest,
  CompanyPortabilitySource,
  CompanyPortabilityImportTarget,
  CompanyPortabilityCollisionStrategy,
  CompanyPortabilityPreviewResult,
} from "@jigongai/shared";

export function CompanyPortability() {
  const { t } = useTranslation();
  const { selectedCompanyId, companies } = useCompany();
  const queryClient = useQueryClient();

  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);

  // Export state
  const [exportIncludeCompany, setExportIncludeCompany] = useState(true);
  const [exportIncludeAgents, setExportIncludeAgents] = useState(true);
  const [exportManifest, setExportManifest] = useState<CompanyPortabilityManifest | null>(null);

  // Import state
  const [importSourceType, setImportSourceType] = useState<"inline" | "url" | "github">("inline");
  const [importManifestText, setImportManifestText] = useState("");
  const [importUrl, setImportUrl] = useState("");
  const [importTarget, setImportTarget] = useState<"new" | "existing">("new");
  const [importTargetCompanyId, setImportTargetCompanyId] = useState("");
  const [collisionStrategy, setCollisionStrategy] = useState<CompanyPortabilityCollisionStrategy>("rename");
  const [previewResult, setPreviewResult] = useState<CompanyPortabilityPreviewResult | null>(null);

  const { data: companiesList } = useQuery({
    queryKey: queryKeys.companies.all,
    queryFn: () => companiesApi.list(),
  });

  const exportMutation = useMutation({
    mutationFn: () =>
      companiesApi.exportBundle(selectedCompanyId!, {
        include: {
          company: exportIncludeCompany,
          agents: exportIncludeAgents,
        },
      }),
    onSuccess: (data) => {
      setExportManifest(data.manifest);
    },
  });

  const previewMutation = useMutation({
    mutationFn: async () => {
      let source: CompanyPortabilitySource;
      if (importSourceType === "inline") {
        source = {
          type: "inline",
          manifest: JSON.parse(importManifestText),
          files: {},
        };
      } else {
        source = {
          type: importSourceType,
          url: importUrl,
        };
      }

      const target: CompanyPortabilityImportTarget =
        importTarget === "new"
          ? { mode: "new_company" }
          : { mode: "existing_company", companyId: importTargetCompanyId };

      return companiesApi.importPreview({
        source,
        target,
        collisionStrategy,
      });
    },
    onSuccess: (data) => {
      setPreviewResult(data);
      setPreviewDialogOpen(true);
    },
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      let source: CompanyPortabilitySource;
      if (importSourceType === "inline") {
        source = {
          type: "inline",
          manifest: JSON.parse(importManifestText),
          files: {},
        };
      } else {
        source = {
          type: importSourceType,
          url: importUrl,
        };
      }

      const target: CompanyPortabilityImportTarget =
        importTarget === "new"
          ? { mode: "new_company" }
          : { mode: "existing_company", companyId: importTargetCompanyId };

      return companiesApi.importBundle({
        source,
        target,
        collisionStrategy,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });
      setImportDialogOpen(false);
      setPreviewDialogOpen(false);
      setPreviewResult(null);
    },
  });

  function handleExport() {
    exportMutation.mutate();
  }

  function handleDownloadManifest() {
    if (!exportManifest) return;
    const blob = new Blob([JSON.stringify(exportManifest, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `company-manifest-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handlePreview() {
    previewMutation.mutate();
  }

  function handleImport() {
    importMutation.mutate();
  }

  function resetImportForm() {
    setImportSourceType("inline");
    setImportManifestText("");
    setImportUrl("");
    setImportTarget("new");
    setImportTargetCompanyId("");
    setCollisionStrategy("rename");
    setPreviewResult(null);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("portability.title", "公司导入/导出")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("portability.description", "备份公司数据或从其他公司导入配置")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setExportDialogOpen(true)}>
            <Download className="h-4 w-4 mr-2" />
            {t("portability.export", "导出")}
          </Button>
          <Button onClick={() => setImportDialogOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            {t("portability.import", "导入")}
          </Button>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              {t("portability.exportTitle", "导出公司数据")}
            </CardTitle>
            <CardDescription>{t("portability.exportDescription", "生成公司配置和代理的备份文件")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="text-sm space-y-2 text-muted-foreground">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                {t("portability.exportFeature1", "导出公司基本信息")}
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                {t("portability.exportFeature2", "导出所有代理配置")}
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                {t("portability.exportFeature3", "生成标准 JSON 清单")}
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              {t("portability.importTitle", "导入公司数据")}
            </CardTitle>
            <CardDescription>{t("portability.importDescription", "从其他公司或备份文件导入配置")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="text-sm space-y-2 text-muted-foreground">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                {t("portability.importFeature1", "支持从 URL/GitHub 导入")}
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                {t("portability.importFeature2", "导入前预览变更")}
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                {t("portability.importFeature3", "支持冲突处理策略")}
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Export Dialog */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("portability.export", "导出公司数据")}</DialogTitle>
            <DialogDescription>
              {t("portability.exportHelp", "选择要导出的数据类型")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3">
              <Checkbox
                id="export-company"
                checked={exportIncludeCompany}
                onCheckedChange={(v) => setExportIncludeCompany(v === true)}
              />
              <Label htmlFor="export-company">
                {t("portability.includeCompany", "公司信息")}
                <p className="text-xs text-muted-foreground">
                  {t("portability.includeCompanyHelp", "名称、描述、品牌色等")}
                </p>
              </Label>
            </div>

            <div className="flex items-center gap-3">
              <Checkbox
                id="export-agents"
                checked={exportIncludeAgents}
                onCheckedChange={(v) => setExportIncludeAgents(v === true)}
              />
              <Label htmlFor="export-agents">
                {t("portability.includeAgents", "代理配置")}
                <p className="text-xs text-muted-foreground">
                  {t("portability.includeAgentsHelp", "所有代理的定义和配置")}
                </p>
              </Label>
            </div>
          </div>

          {exportManifest && (
            <div className="flex items-center gap-2 text-green-600 bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
              <CheckCircle2 className="h-4 w-4" />
              <p className="text-sm">
                {t("portability.exportSuccess", "导出成功！点击下方按钮下载清单文件。")}
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setExportDialogOpen(false)}>
              {t("common.cancel", "取消")}
            </Button>
            {exportManifest ? (
              <Button onClick={handleDownloadManifest}>
                <Download className="h-4 w-4 mr-2" />
                {t("portability.downloadManifest", "下载清单")}
              </Button>
            ) : (
              <Button onClick={handleExport} disabled={exportMutation.isPending}>
                {exportMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {t("portability.export", "导出")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("portability.import", "导入公司数据")}</DialogTitle>
            <DialogDescription>
              {t("portability.importHelp", "选择数据源并预览导入效果")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Source Type */}
            <div className="space-y-2">
              <Label>{t("portability.sourceType", "数据源类型")}</Label>
              <Select value={importSourceType} onValueChange={(v) => setImportSourceType(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inline">
                    <FileJson className="h-4 w-4 mr-2 inline" />
                    {t("portability.sourceInline", "直接粘贴清单")}
                  </SelectItem>
                  <SelectItem value="url">
                    <LinkIcon className="h-4 w-4 mr-2 inline" />
                    {t("portability.sourceUrl", "URL 地址")}
                  </SelectItem>
                  <SelectItem value="github">
                    <Github className="h-4 w-4 mr-2 inline" />
                    {t("portability.sourceGithub", "GitHub 仓库")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Source Input */}
            {importSourceType === "inline" ? (
              <div className="space-y-2">
                <Label htmlFor="manifest-text">{t("portability.manifestJson", "清单 JSON")}</Label>
                <Textarea
                  id="manifest-text"
                  rows={10}
                  value={importManifestText}
                  onChange={(e) => setImportManifestText(e.target.value)}
                  placeholder='{"schemaVersion": 1, ...}'
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="source-url">{t("portability.sourceUrlLabel", "源地址")}</Label>
                <Input
                  id="source-url"
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                  placeholder={
                    importSourceType === "url"
                      ? "https://example.com/manifest.json"
                      : "https://github.com/owner/repo"
                  }
                />
              </div>
            )}

            {/* Target */}
            <div className="space-y-2">
              <Label>{t("portability.importTarget", "导入目标")}</Label>
              <Select value={importTarget} onValueChange={(v) => setImportTarget(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">{t("portability.targetNew", "创建新公司")}</SelectItem>
                  <SelectItem value="existing">{t("portability.targetExisting", "导入到现有公司")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {importTarget === "existing" && (
              <div className="space-y-2">
                <Label htmlFor="target-company">{t("portability.selectCompany", "选择公司")}</Label>
                <Select value={importTargetCompanyId} onValueChange={setImportTargetCompanyId}>
                  <SelectTrigger id="target-company">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {companiesList?.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Collision Strategy */}
            <div className="space-y-2">
              <Label>{t("portability.collisionStrategy", "冲突处理策略")}</Label>
              <Select value={collisionStrategy} onValueChange={(v) => setCollisionStrategy(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rename">{t("portability.collisionRename", "重命名冲突项")}</SelectItem>
                  <SelectItem value="skip">{t("portability.collisionSkip", "跳过冲突项")}</SelectItem>
                  <SelectItem value="replace">{t("portability.collisionReplace", "替换冲突项")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetImportForm}>
              {t("common.cancel", "取消")}
            </Button>
            <Button onClick={handlePreview} disabled={previewMutation.isPending}>
              {previewMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Eye className="h-4 w-4 mr-2" />
              {t("portability.preview", "预览")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("portability.previewTitle", "导入预览")}</DialogTitle>
            <DialogDescription>
              {t("portability.previewDescription", "查看导入将产生的变更")}
            </DialogDescription>
          </DialogHeader>

          {previewResult && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid gap-3 md:grid-cols-3">
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold">
                      {previewResult.plan.agentPlans.filter((p) => p.action === "create").length}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t("portability.previewCreate", "将创建")}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold">
                      {previewResult.plan.agentPlans.filter((p) => p.action === "update").length}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t("portability.previewUpdate", "将更新")}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold">
                      {previewResult.plan.agentPlans.filter((p) => p.action === "skip").length}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t("portability.previewSkip", "将跳过")}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Agent Plans */}
              <div className="space-y-2">
                <Label>{t("portability.agentPlans", "代理计划")}</Label>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {previewResult.plan.agentPlans.map((plan) => (
                    <div
                      key={plan.slug}
                      className="flex items-center justify-between p-2 border rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{plan.plannedName}</p>
                        <p className="text-xs text-muted-foreground">
                          {plan.reason || plan.action}
                        </p>
                      </div>
                      <Badge
                        variant={
                          plan.action === "create"
                            ? "default"
                            : plan.action === "update"
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {plan.action === "create"
                          ? t("portability.actionCreate", "创建")
                          : plan.action === "update"
                          ? t("portability.actionUpdate", "更新")
                          : t("portability.actionSkip", "跳过")}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              {/* Required Secrets */}
              {previewResult.requiredSecrets.length > 0 && (
                <div className="flex items-start gap-2 text-destructive bg-destructive/10 p-3 rounded-lg">
                  <AlertCircle className="h-4 w-4 mt-0.5" />
                  <div>
                    <p className="font-medium">{t("portability.requiredSecrets", "需要配置密钥")}</p>
                    <ul className="text-sm mt-1 space-y-1">
                      {previewResult.requiredSecrets.map((secret) => (
                        <li key={secret.key}>
                          <code className="bg-muted px-1 py-0.5 rounded">{secret.key}</code>
                          {secret.description && ` - ${secret.description}`}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Warnings */}
              {previewResult.warnings.length > 0 && (
                <div className="flex items-start gap-2 text-amber-600 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">
                  <AlertCircle className="h-4 w-4 mt-0.5" />
                  <div>
                    <p className="font-medium">{t("portability.warnings", "警告")}</p>
                    <ul className="text-sm mt-1 space-y-1">
                      {previewResult.warnings.map((warning, i) => (
                        <li key={i}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Errors */}
              {previewResult.errors.length > 0 && (
                <div className="flex items-start gap-2 text-destructive bg-destructive/10 p-3 rounded-lg">
                  <XCircle className="h-4 w-4 mt-0.5" />
                  <div>
                    <p className="font-medium">{t("portability.errors", "错误")}</p>
                    <ul className="text-sm mt-1 space-y-1">
                      {previewResult.errors.map((error, i) => (
                        <li key={i}>{error}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewDialogOpen(false)}>
              {t("common.cancel", "取消")}
            </Button>
            <Button onClick={handleImport} disabled={importMutation.isPending}>
              {importMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Upload className="h-4 w-4 mr-2" />
              {t("portability.import", "导入")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
