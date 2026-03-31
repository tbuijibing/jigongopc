/**
 * SpecDocsPage - AI 规范文档管理页面
 * 
 * 提供规范文档的浏览、读取、编辑和管理功能
 */

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FileIcon, FolderIcon, PlusIcon, RefreshCw, Search, Edit2, Trash2, Eye } from "lucide-react";
import { useToast } from "@/hooks/useToast";

// API 调用函数
async function fetchDocsList(prefix?: string, role?: string) {
  const params = new URLSearchParams();
  if (prefix) params.append("prefix", prefix);
  if (role) params.append("role", role);
  
  const response = await fetch(`/api/modules/ai-spec-docs/docs?${params.toString()}`);
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || "Failed to fetch docs");
  }
  return response.json();
}

async function fetchDocContent(path: string, role?: string) {
  const params = new URLSearchParams();
  if (role) params.append("role", role);
  
  const response = await fetch(`/api/modules/ai-spec-docs/docs/${encodeURIComponent(path)}?${params.toString()}`);
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || "Failed to fetch doc");
  }
  return response.json();
}

async function createOrUpdateDoc(data: { path: string; content: string; metadata?: Record<string, unknown> }) {
  const response = await fetch("/api/modules/ai-spec-docs/docs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || "Failed to save doc");
  }
  return response.json();
}

async function fetchTemplates(type?: string) {
  const params = type ? `?type=${type}` : "";
  const response = await fetch(`/api/modules/ai-spec-docs/templates${params}`);
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || "Failed to fetch templates");
  }
  return response.json();
}

async function initProject(data: { projectName: string; template?: string }) {
  const response = await fetch("/api/modules/ai-spec-docs/init", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || "Failed to init project");
  }
  return response.json();
}

async function fetchHealth() {
  const response = await fetch("/api/modules/ai-spec-docs/health");
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || "Failed to fetch health");
  }
  return response.json();
}

interface DocFile {
  path: string;
  size: number;
  modifiedAt: string;
  write: boolean;
}

interface DocListResponse {
  role: string;
  count: number;
  files: DocFile[];
}

interface DocContentResponse {
  path: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export function SpecDocsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDoc, setSelectedDoc] = useState<DocFile | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [initDialogOpen, setInitDialogOpen] = useState(false);
  const [docContent, setDocContent] = useState("");
  const [editContent, setEditContent] = useState("");
  const [prefixFilter, setPrefixFilter] = useState("all");
  const [newProjectName, setNewProjectName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("standard");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 获取健康状态
  const { data: healthData, isLoading: healthLoading } = useQuery({
    queryKey: ["ai-spec-docs-health"],
    queryFn: fetchHealth,
    refetchInterval: 30000,
  });

  // 获取文档列表
  const { data: docsData, isLoading: docsLoading } = useQuery<DocListResponse>({
    queryKey: ["ai-spec-docs-list", prefixFilter],
    queryFn: () => fetchDocsList(prefixFilter === "all" ? undefined : prefixFilter),
  });

  // 获取模板列表
  const { data: templatesData } = useQuery({
    queryKey: ["ai-spec-docs-templates"],
    queryFn: () => fetchTemplates(),
  });

  // 初始化项目 mutation
  const initMutation = useMutation({
    mutationFn: initProject,
    onSuccess: (data) => {
      toast({
        title: "项目初始化成功",
        description: `项目 ID: ${data.projectId}`,
      });
      setInitDialogOpen(false);
      setNewProjectName("");
      queryClient.invalidateQueries({ queryKey: ["ai-spec-docs-list"] });
    },
    onError: (error) => {
      toast({
        title: "初始化失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // 保存文档 mutation
  const saveMutation = useMutation({
    mutationFn: createOrUpdateDoc,
    onSuccess: () => {
      toast({
        title: "保存成功",
        description: "文档已保存",
      });
      setEditDialogOpen(false);
      setSelectedDoc(null);
      queryClient.invalidateQueries({ queryKey: ["ai-spec-docs-list"] });
    },
    onError: (error) => {
      toast({
        title: "保存失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // 查看文档
  const handleViewDoc = async (doc: DocFile) => {
    try {
      const data = await fetchDocContent(doc.path);
      setDocContent(data.content);
      setSelectedDoc(doc);
      setViewDialogOpen(true);
    } catch (error) {
      toast({
        title: "读取失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
      });
    }
  };

  // 编辑文档
  const handleEditDoc = async (doc: DocFile) => {
    try {
      const data = await fetchDocContent(doc.path);
      setEditContent(data.content);
      setSelectedDoc(doc);
      setEditDialogOpen(true);
    } catch (error) {
      toast({
        title: "读取失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
      });
    }
  };

  // 保存编辑
  const handleSaveDoc = () => {
    if (!selectedDoc) return;
    saveMutation.mutate({
      path: selectedDoc.path,
      content: editContent,
      metadata: {
        ...selectedDoc,
        updatedAt: new Date().toISOString(),
      },
    });
  };

  // 初始化项目
  const handleInitProject = () => {
    if (!newProjectName.trim()) {
      toast({
        title: "项目名称不能为空",
        variant: "destructive",
      });
      return;
    }
    initMutation.mutate({
      projectName: newProjectName,
      template: selectedTemplate,
    });
  };

  // 过滤文档列表
  const filteredDocs = docsData?.files?.filter((doc) =>
    doc.path.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  // 格式化文件大小
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // 格式化时间
  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleString("zh-CN");
  };

  // 获取路径的文件夹和文件名
  const getPathParts = (path: string) => {
    const lastSlash = path.lastIndexOf("/");
    if (lastSlash === -1) {
      return { folder: "", name: path };
    }
    return {
      folder: path.substring(0, lastSlash),
      name: path.substring(lastSlash + 1),
    };
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">AI 规范文档</h1>
          <p className="text-muted-foreground">
            规范驱动的 AI 开发系统：AI 按规范完成 95% 工作，人类只做监督
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["ai-spec-docs-list"] })}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            刷新
          </Button>
          <Button onClick={() => setInitDialogOpen(true)}>
            <PlusIcon className="w-4 h-4 mr-2" />
            新建项目
          </Button>
        </div>
      </div>

      {/* 健康状态提示 */}
      {healthLoading ? (
        <Skeleton className="h-12 w-full" />
      ) : healthData?.docspecServerUrl === "not configured" ? (
        <Card className="border-yellow-500 bg-yellow-50">
          <CardHeader>
            <CardTitle className="text-yellow-800">⚠️ 需要配置 docspec-server</CardTitle>
            <CardDescription className="text-yellow-700">
              请先配置 docspec-server 连接信息才能使用完整功能
            </CardDescription>
          </CardHeader>
          <CardContent>
            <code className="block bg-yellow-100 p-3 rounded text-sm">
              curl -X POST http://localhost:3100/api/modules/ai-spec-docs/config \<br/>
              &nbsp;&nbsp;-H "Content-Type: application/json" \<br/>
              &nbsp;&nbsp;-d '{"key": "docspecServerUrl", "value": "http://localhost:4000"}'
            </code>
          </CardContent>
        </Card>
      ) : null}

      {/* 过滤器 */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="搜索文档..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={prefixFilter} onValueChange={setPrefixFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="全部目录" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部目录</SelectItem>
            <SelectItem value="specs/">specs/</SelectItem>
            <SelectItem value="templates/">templates/</SelectItem>
            <SelectItem value="decisions/">decisions/</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 文档列表 */}
      <Card>
        <CardHeader>
          <CardTitle>文档列表</CardTitle>
          <CardDescription>
            {docsLoading ? "加载中..." : `共 ${docsData?.count || 0} 个文档`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {docsLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>暂无文档</p>
              <p className="text-sm">点击"新建项目"创建规范文档</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredDocs.map((doc) => {
                const { folder, name } = getPathParts(doc.path);
                return (
                  <div
                    key={doc.path}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {folder ? (
                        <FolderIcon className="w-5 h-5 text-blue-500 shrink-0" />
                      ) : (
                        <FileIcon className="w-5 h-5 text-gray-500 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{name}</div>
                        {folder && (
                          <div className="text-sm text-muted-foreground truncate">
                            {folder}/
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-sm text-muted-foreground text-right">
                        <div>{formatSize(doc.size)}</div>
                        <div>{formatTime(doc.modifiedAt)}</div>
                      </div>
                      {doc.write && (
                        <Badge variant="secondary" className="text-xs">
                          可编辑
                        </Badge>
                      )}
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleViewDoc(doc)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        {doc.write && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditDoc(doc)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 查看文档对话框 */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{selectedDoc?.path}</DialogTitle>
            <DialogDescription>
              大小：{selectedDoc && formatSize(selectedDoc.size)} | 
              修改时间：{selectedDoc && formatTime(selectedDoc.modifiedAt)}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <pre className="bg-muted p-4 rounded-lg overflow-auto max-h-[60vh] whitespace-pre-wrap break-words text-sm">
              {docContent}
            </pre>
          </div>
          <DialogFooter>
            {selectedDoc?.write && (
              <Button onClick={() => { setViewDialogOpen(false); handleEditDoc(selectedDoc); }}>
                <Edit2 className="w-4 h-4 mr-2" />
                编辑
              </Button>
            )}
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑文档对话框 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>编辑：{selectedDoc?.path}</DialogTitle>
            <DialogDescription>
              修改文档内容并保存
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="min-h-[400px] font-mono text-sm"
            />
          </div>
          <DialogFooter>
            <Button
              onClick={handleSaveDoc}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? "保存中..." : "保存"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
            >
              取消
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 新建项目对话框 */}
      <Dialog open={initDialogOpen} onOpenChange={setInitDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建项目</DialogTitle>
            <DialogDescription>
              初始化新项目的规范文档结构
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="projectName">项目名称</Label>
              <Input
                id="projectName"
                placeholder="my-project"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template">模板类型</Label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">标准模板</SelectItem>
                  <SelectItem value="api">API 项目</SelectItem>
                  <SelectItem value="frontend">前端项目</SelectItem>
                  <SelectItem value="minimal">最小模板</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleInitProject}
              disabled={initMutation.isPending}
            >
              {initMutation.isPending ? "初始化中..." : "初始化"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setInitDialogOpen(false)}
            >
              取消
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
