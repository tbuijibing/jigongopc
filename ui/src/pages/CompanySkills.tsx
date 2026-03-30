import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "@/lib/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { companySkillsApi } from "../api/companySkills";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { cn } from "../lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import {
  Book,
  Plus,
  Search,
  Trash2,
  Edit,
  RefreshCw,
  Github,
  Folder,
  Link as LinkIcon,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  XCircle,
  HelpCircle,
} from "lucide-react";
import type { CompanySkill } from "@jigongai/shared";

const sourceTypeLabels: Record<string, string> = {
  local_path: "本地路径",
  github: "GitHub",
  url: "URL",
};

const trustLevelLabels: Record<string, string> = {
  markdown_only: "仅 Markdown",
  full_code: "完整代码",
};

const compatibilityLabels: Record<string, string> = {
  compatible: "兼容",
  incompatible: "不兼容",
  unknown: "未知",
};

const sourceTypeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  local_path: Folder,
  github: Github,
  url: LinkIcon,
};

const trustLevelIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  markdown_only: Shield,
  full_code: ShieldCheck,
};

const compatibilityIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  compatible: CheckCircle2,
  incompatible: ShieldAlert,
  unknown: HelpCircle,
};

export function CompanySkills() {
  const { t } = useTranslation();
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [sourceTypeFilter, setSourceTypeFilter] = useState<string>("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editSkill, setEditSkill] = useState<CompanySkill | null>(null);
  const [deleteSkill, setDeleteSkill] = useState<CompanySkill | null>(null);

  const { data: skills, isLoading, error } = useQuery({
    queryKey: queryKeys.companySkills.list(selectedCompanyId!),
    queryFn: () => companySkillsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => companySkillsApi.create(selectedCompanyId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.companySkills.list(selectedCompanyId!) });
      setCreateDialogOpen(false);
      alert("技能创建成功");
    },
    onError: (err: any) => {
      alert(`创建失败：${err.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ skillId, data }: { skillId: string; data: any }) =>
      companySkillsApi.update(selectedCompanyId!, skillId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.companySkills.list(selectedCompanyId!) });
      setEditSkill(null);
      alert("技能更新成功");
    },
    onError: (err: any) => {
      alert(`更新失败：${err.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (skillId: string) => companySkillsApi.delete(selectedCompanyId!, skillId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.companySkills.list(selectedCompanyId!) });
      setDeleteSkill(null);
      alert("技能已删除");
    },
    onError: (err: any) => {
      alert(`删除失败：${err.message}`);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: (skillId: string) =>
      fetch(`/api/companies/${selectedCompanyId}/skills/${skillId}/update-status`, {
        method: "POST",
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.companySkills.list(selectedCompanyId!) });
      alert("技能状态已更新");
    },
    onError: (err: any) => {
      alert(`更新状态失败：${err.message}`);
    },
  });

  useEffect(() => {
    setBreadcrumbs([
      { label: "公司技能库", href: "/skills" },
    ]);
  }, [setBreadcrumbs]);

  const filteredSkills = skills?.filter((skill) => {
    const matchesSearch =
      skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      skill.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      skill.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = sourceTypeFilter === "all" || skill.sourceType === sourceTypeFilter;
    return matchesSearch && matchesType;
  });

  if (isLoading) {
    return <PageSkeleton />;
  }

  if (error) {
    return (
      <EmptyState
        icon={XCircle}
        message={`加载失败：${error.message}`}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">公司技能库</h1>
          <p className="text-sm text-muted-foreground">
            可复用的代理配置和技能包管理
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          添加技能
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="搜索技能..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={sourceTypeFilter} onValueChange={setSourceTypeFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="来源类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            <SelectItem value="local_path">本地路径</SelectItem>
            <SelectItem value="github">GitHub</SelectItem>
            <SelectItem value="url">URL</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredSkills?.length === 0 ? (
        <EmptyState
          icon={Book}
          message={
            skills?.length === 0
              ? "暂无技能 - 点击'添加技能'创建第一个技能包"
              : "未找到匹配的技能 - 尝试调整搜索条件"
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredSkills?.map((skill) => {
            const SourceIcon = sourceTypeIcons[skill.sourceType] || Folder;
            const TrustIcon = trustLevelIcons[skill.trustLevel] || Shield;
            const CompatIcon = compatibilityIcons[skill.compatibility] || HelpCircle;

            return (
              <Card key={skill.id} className="relative">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <SourceIcon className="w-5 h-5 text-muted-foreground" />
                      <CardTitle className="text-lg">{skill.name}</CardTitle>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge
                        variant={skill.compatibility === "compatible" ? "default" : "destructive"}
                        className="text-xs"
                      >
                        <CompatIcon className="w-3 h-3 mr-1" />
                        {compatibilityLabels[skill.compatibility]}
                      </Badge>
                    </div>
                  </div>
                  <CardDescription className="line-clamp-2">
                    {skill.description || skill.key}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">来源</span>
                      <span className="flex items-center gap-1">
                        <SourceIcon className="w-3 h-3" />
                        {sourceTypeLabels[skill.sourceType]}
                      </span>
                    </div>
                    {skill.sourceLocator && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">位置</span>
                        <span className="text-muted-foreground truncate max-w-[200px]">
                          {skill.sourceLocator}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">信任级别</span>
                      <span className="flex items-center gap-1">
                        <TrustIcon className="w-3 h-3" />
                        {trustLevelLabels[skill.trustLevel]}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">文件数</span>
                      <span>{Array.isArray(skill.fileInventory) ? skill.fileInventory.length : 0}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setEditSkill(skill)}
                    >
                      <Edit className="w-3 h-3 mr-1" />
                      编辑
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateStatusMutation.mutate(skill.id)}
                    >
                      <RefreshCw className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteSkill(skill)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <CreateEditSkillDialog
        open={createDialogOpen || !!editSkill}
        skill={editSkill}
        onClose={() => {
          setCreateDialogOpen(false);
          setEditSkill(null);
        }}
        onSubmit={(data) => {
          if (editSkill) {
            updateMutation.mutate({ skillId: editSkill.id, data });
          } else {
            createMutation.mutate(data);
          }
        }}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      <DeleteSkillDialog
        skill={deleteSkill}
        open={!!deleteSkill}
        onClose={() => setDeleteSkill(null)}
        onConfirm={() => deleteSkill && deleteMutation.mutate(deleteSkill.id)}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}

interface CreateEditSkillDialogProps {
  open: boolean;
  skill: CompanySkill | null;
  onClose: () => void;
  onSubmit: (data: any) => void;
  isLoading: boolean;
}

function CreateEditSkillDialog({ open, skill, onClose, onSubmit, isLoading }: CreateEditSkillDialogProps) {
  const [formData, setFormData] = useState({
    key: "",
    slug: "",
    name: "",
    description: "",
    markdown: "",
    sourceType: "local_path" as "local_path" | "github" | "url",
    sourceLocator: "",
    sourceRef: "",
    trustLevel: "markdown_only" as "markdown_only" | "full_code",
    metadata: null as Record<string, unknown> | null,
  });

  useEffect(() => {
    if (skill) {
      setFormData({
        key: skill.key,
        slug: skill.slug,
        name: skill.name,
        description: skill.description || "",
        markdown: skill.markdown,
        sourceType: skill.sourceType,
        sourceLocator: skill.sourceLocator || "",
        sourceRef: skill.sourceRef || "",
        trustLevel: skill.trustLevel,
        metadata: skill.metadata,
      });
    } else {
      setFormData({
        key: "",
        slug: "",
        name: "",
        description: "",
        markdown: "",
        sourceType: "local_path",
        sourceLocator: "",
        sourceRef: "",
        trustLevel: "markdown_only",
        metadata: null,
      });
    }
  }, [skill, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{skill ? "编辑技能" : "添加技能"}</DialogTitle>
          <DialogDescription>
            {skill ? "更新技能包配置" : "创建新的可复用技能包"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="key">技能键</Label>
                <Input
                  id="key"
                  value={formData.key}
                  onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                  placeholder="unique-skill-key"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="skill-slug"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">名称</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="技能名称"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">描述</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="技能描述..."
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sourceType">来源类型</Label>
                <Select
                  value={formData.sourceType}
                  onValueChange={(value: any) => setFormData({ ...formData, sourceType: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="local_path">本地路径</SelectItem>
                    <SelectItem value="github">GitHub</SelectItem>
                    <SelectItem value="url">URL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="trustLevel">信任级别</Label>
                <Select
                  value={formData.trustLevel}
                  onValueChange={(value: any) => setFormData({ ...formData, trustLevel: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="markdown_only">仅 Markdown</SelectItem>
                    <SelectItem value="full_code">完整代码</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sourceLocator">来源位置</Label>
              <Input
                id="sourceLocator"
                value={formData.sourceLocator}
                onChange={(e) => setFormData({ ...formData, sourceLocator: e.target.value })}
                placeholder={
                  formData.sourceType === "github"
                    ? "owner/repo"
                    : formData.sourceType === "url"
                    ? "https://..."
                    : "./path/to/skill"
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sourceRef">版本引用</Label>
              <Input
                id="sourceRef"
                value={formData.sourceRef}
                onChange={(e) => setFormData({ ...formData, sourceRef: e.target.value })}
                placeholder="main, v1.0.0, commit-sha"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="markdown">Markdown 内容</Label>
              <Textarea
                id="markdown"
                value={formData.markdown}
                onChange={(e) => setFormData({ ...formData, markdown: e.target.value })}
                placeholder="# 技能文档..."
                rows={8}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {skill ? "更新" : "创建"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface DeleteSkillDialogProps {
  skill: CompanySkill | null;
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading: boolean;
}

function DeleteSkillDialog({ skill, open, onClose, onConfirm, isLoading }: DeleteSkillDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>确认删除</DialogTitle>
          <DialogDescription>
            确定要删除技能"{skill?.name}"吗？此操作不可撤销。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isLoading}>
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            删除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
