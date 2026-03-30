import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "@/lib/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { pluginsApi } from "../api/plugins";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
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
  Puzzle,
  Plus,
  Search,
  Trash2,
  Settings,
  Power,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Package,
  Database,
  Webhook,
  FileText,
} from "lucide-react";
import type { Plugin } from "@jigongai/shared";

const statusLabels: Record<string, string> = {
  active: "已激活",
  inactive: "未激活",
  error: "错误",
};

export function Plugins() {
  const { t } = useTranslation();
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [installDialogOpen, setInstallDialogOpen] = useState(false);
  const [configPlugin, setConfigPlugin] = useState<Plugin | null>(null);
  const [deletePlugin, setDeletePlugin] = useState<Plugin | null>(null);
  const [selectedPlugin, setSelectedPlugin] = useState<Plugin | null>(null);

  const { data: plugins, isLoading, error } = useQuery({
    queryKey: queryKeys.plugins.list(selectedCompanyId!),
    queryFn: () => pluginsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const installMutation = useMutation({
    mutationFn: (data: { name: string; slug: string; version: string; description?: string | null; author?: string | null; manifest: Record<string, unknown> }) =>
      pluginsApi.install(selectedCompanyId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plugins.list(selectedCompanyId!) });
      setInstallDialogOpen(false);
      alert("插件安装成功");
    },
    onError: (err: any) => {
      alert(`安装失败：${err.message}`);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ pluginId, status }: { pluginId: string; status: string }) =>
      pluginsApi.updateStatus(pluginId, { status: status as "active" | "inactive" | "error" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plugins.list(selectedCompanyId!) });
      alert("插件状态已更新");
    },
    onError: (err: any) => {
      alert(`更新状态失败：${err.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (pluginId: string) => pluginsApi.delete(pluginId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plugins.list(selectedCompanyId!) });
      setDeletePlugin(null);
      alert("插件已删除");
    },
    onError: (err: any) => {
      alert(`删除失败：${err.message}`);
    },
  });

  useEffect(() => {
    setBreadcrumbs([
      { label: "插件系统", href: "/plugins" },
    ]);
  }, [setBreadcrumbs]);

  const filteredPlugins = plugins?.filter((plugin) => {
    const matchesSearch =
      plugin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plugin.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || plugin.status === statusFilter;
    return matchesSearch && matchesStatus;
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
          <h1 className="text-2xl font-bold">插件系统</h1>
          <p className="text-sm text-muted-foreground">
            可扩展的插件管理
          </p>
        </div>
        <Button onClick={() => setInstallDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          安装插件
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="搜索插件..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            <SelectItem value="active">已激活</SelectItem>
            <SelectItem value="inactive">未激活</SelectItem>
            <SelectItem value="error">错误</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredPlugins?.length === 0 ? (
        <EmptyState
          icon={Puzzle}
          message={
            plugins?.length === 0
              ? "暂无插件 - 点击'安装插件'添加第一个插件"
              : "未找到匹配的插件 - 尝试调整搜索条件"
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredPlugins?.map((plugin) => {
            const StatusIcon = plugin.status === "active" ? CheckCircle2 : plugin.status === "inactive" ? Power : AlertCircle;
            
            return (
              <Card key={plugin.id} className="relative">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Puzzle className="w-5 h-5 text-muted-foreground" />
                      <CardTitle className="text-lg">{plugin.name}</CardTitle>
                    </div>
                    <Badge variant={plugin.status === "active" ? "default" : "secondary"} className="text-xs">
                      <StatusIcon className="w-3 h-3 mr-1" />
                      {statusLabels[plugin.status]}
                    </Badge>
                  </div>
                  <CardDescription className="line-clamp-2">
                    {plugin.description || "暂无描述"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">版本</span>
                      <span className="font-mono text-xs">{plugin.version || "1.0.0"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">作者</span>
                      <span>{plugin.author || "未知"}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Database className="w-3 h-3" />
                        v{plugin.version}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setSelectedPlugin(plugin)}
                    >
                      详情
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConfigPlugin(plugin)}
                    >
                      <Settings className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateStatusMutation.mutate({ 
                        pluginId: plugin.id, 
                        status: plugin.status === "active" ? "inactive" : "active" 
                      })}
                    >
                      <Power className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeletePlugin(plugin)}
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

      <PluginDetailDialog
        plugin={selectedPlugin}
        open={!!selectedPlugin}
        onClose={() => setSelectedPlugin(null)}
      />

      <PluginConfigDialog
        plugin={configPlugin}
        open={!!configPlugin}
        onClose={() => setConfigPlugin(null)}
      />

      <InstallPluginDialog
        open={installDialogOpen}
        onClose={() => setInstallDialogOpen(false)}
        onInstall={(data) => installMutation.mutate(data)}
        isLoading={installMutation.isPending}
      />

      <DeletePluginDialog
        plugin={deletePlugin}
        open={!!deletePlugin}
        onClose={() => setDeletePlugin(null)}
        onDelete={() => deletePlugin && deleteMutation.mutate(deletePlugin.id)}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}

interface PluginDetailDialogProps {
  plugin: Plugin | null;
  open: boolean;
  onClose: () => void;
}

function PluginDetailDialog({ plugin, open, onClose }: PluginDetailDialogProps) {
  if (!plugin) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{plugin.name}</DialogTitle>
          <DialogDescription>{plugin.description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium mb-1">版本</h4>
              <p className="text-sm text-muted-foreground font-mono">{plugin.version || "1.0.0"}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium mb-1">作者</h4>
              <p className="text-sm text-muted-foreground">{plugin.author || "未知"}</p>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium mb-1">状态</h4>
            <Badge variant={plugin.status === "active" ? "default" : "secondary"}>
              {statusLabels[plugin.status]}
            </Badge>
          </div>
          {plugin.manifest && (
            <div>
              <h4 className="text-sm font-medium mb-2">Manifest</h4>
              <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-40">
                {JSON.stringify(plugin.manifest, null, 2)}
              </pre>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-muted rounded">
              <Package className="w-5 h-5 mx-auto mb-1" />
              <div className="text-lg font-bold">{plugin.version || "1.0.0"}</div>
              <div className="text-xs text-muted-foreground">版本</div>
            </div>
            <div className="text-center p-3 bg-muted rounded">
              <Badge variant={plugin.status === "active" ? "default" : "secondary"} className="mx-auto">
                {statusLabels[plugin.status]}
              </Badge>
              <div className="text-xs text-muted-foreground mt-1">状态</div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>关闭</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface PluginConfigDialogProps {
  plugin: Plugin | null;
  open: boolean;
  onClose: () => void;
}

function PluginConfigDialog({ plugin, open, onClose }: PluginConfigDialogProps) {
  const [config, setConfig] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (plugin) {
      // 这里可以加载插件配置
      setConfig({});
    }
  }, [plugin]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>配置插件：{plugin?.name}</DialogTitle>
          <DialogDescription>管理插件配置项</DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <div className="text-sm text-muted-foreground text-center py-8">
            插件配置功能即将推出
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>关闭</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface InstallPluginDialogProps {
  open: boolean;
  onClose: () => void;
  onInstall: (data: { name: string; slug: string; version: string; description?: string | null; author?: string | null; manifest: Record<string, unknown> }) => void;
  isLoading: boolean;
}

function InstallPluginDialog({ open, onClose, onInstall, isLoading }: InstallPluginDialogProps) {
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    version: "1.0.0",
    description: "",
    author: "",
    manifest: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const manifest = JSON.parse(formData.manifest);
      onInstall({
        name: formData.name,
        slug: formData.slug || formData.name.toLowerCase().replace(/\s+/g, "-"),
        version: formData.version,
        description: formData.description || null,
        author: formData.author || null,
        manifest,
      });
    } catch (err) {
      alert("无效的 JSON 格式");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>安装插件</DialogTitle>
          <DialogDescription>输入插件名称和 Manifest JSON</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">插件名称</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="my-plugin"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                placeholder="my-plugin"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="version">版本</Label>
              <Input
                id="version"
                value={formData.version}
                onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                placeholder="1.0.0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="author">作者</Label>
              <Input
                id="author"
                value={formData.author}
                onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                placeholder="Your Name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">描述</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="插件描述"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manifest">Manifest JSON</Label>
              <Textarea
                id="manifest"
                value={formData.manifest}
                onChange={(e) => setFormData({ ...formData, manifest: e.target.value })}
                placeholder='{"key": "value"}'
                rows={6}
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
              安装
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface DeletePluginDialogProps {
  plugin: Plugin | null;
  open: boolean;
  onClose: () => void;
  onDelete: () => void;
  isLoading: boolean;
}

function DeletePluginDialog({ plugin, open, onClose, onDelete, isLoading }: DeletePluginDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>确认删除</DialogTitle>
          <DialogDescription>
            确定要删除插件"{plugin?.name}"吗？此操作不可撤销。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button variant="destructive" onClick={onDelete} disabled={isLoading}>
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            删除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
