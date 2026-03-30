import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "@/lib/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { routinesApi } from "../api/routines";
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
  Clock,
  Plus,
  Search,
  Trash2,
  Edit,
  Play,
  Pause,
  Calendar,
  Zap,
  Bell,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";
import type { Routine, RoutineTrigger } from "@jigongai/shared";

const statusLabels: Record<string, string> = {
  active: "活跃",
  paused: "暂停",
  completed: "已完成",
  archived: "已归档",
};

const triggerTypeLabels: Record<string, string> = {
  cron: "定时",
  webhook: "Webhook",
  event: "事件",
};

const concurrencyLabels: Record<string, string> = {
  coalesce_if_active: "合并",
  allow_multiple: "多实例",
  skip_if_active: "跳过",
};

const catchUpLabels: Record<string, string> = {
  skip_missed: "跳过",
  run_all_missed: "全部执行",
  run_latest_only: "仅最新",
};

export function Routines() {
  const { t } = useTranslation();
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editRoutine, setEditRoutine] = useState<Routine | null>(null);
  const [deleteRoutine, setDeleteRoutine] = useState<Routine | null>(null);
  const [selectedRoutine, setSelectedRoutine] = useState<Routine | null>(null);

  const { data: routines, isLoading, error } = useQuery({
    queryKey: queryKeys.routines.list(selectedCompanyId!),
    queryFn: () => routinesApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => routinesApi.create(selectedCompanyId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.routines.list(selectedCompanyId!) });
      setCreateDialogOpen(false);
      alert("例行任务创建成功");
    },
    onError: (err: any) => {
      alert(`创建失败：${err.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ routineId, data }: { routineId: string; data: any }) =>
      routinesApi.update(routineId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.routines.list(selectedCompanyId!) });
      setEditRoutine(null);
      alert("例行任务更新成功");
    },
    onError: (err: any) => {
      alert(`更新失败：${err.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (routineId: string) => routinesApi.delete(routineId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.routines.list(selectedCompanyId!) });
      setDeleteRoutine(null);
      alert("例行任务已删除");
    },
    onError: (err: any) => {
      alert(`删除失败：${err.message}`);
    },
  });

  const runMutation = useMutation({
    mutationFn: (routineId: string) => routinesApi.run(routineId),
    onSuccess: () => {
      alert("例行任务已触发执行");
    },
    onError: (err: any) => {
      alert(`执行失败：${err.message}`);
    },
  });

  useEffect(() => {
    setBreadcrumbs([
      { label: "例行任务", href: "/routines" },
    ]);
  }, [setBreadcrumbs]);

  const filteredRoutines = routines?.filter((routine) => {
    const matchesSearch =
      routine.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      routine.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || routine.status === statusFilter;
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
          <h1 className="text-2xl font-bold">例行任务引擎</h1>
          <p className="text-sm text-muted-foreground">
            自动化循环任务管理
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          创建任务
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="搜索任务..."
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
            <SelectItem value="active">活跃</SelectItem>
            <SelectItem value="paused">暂停</SelectItem>
            <SelectItem value="error">错误</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredRoutines?.length === 0 ? (
        <EmptyState
          icon={Clock}
          message={
            routines?.length === 0
              ? "暂无例行任务 - 点击'创建任务'添加第一个自动化任务"
              : "未找到匹配的任务 - 尝试调整搜索条件"
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredRoutines?.map((routine) => {
            const StatusIcon = routine.status === "active" ? CheckCircle2 : routine.status === "paused" ? Pause : AlertCircle;
            
            return (
              <Card key={routine.id} className="relative">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Zap className="w-5 h-5 text-muted-foreground" />
                      <CardTitle className="text-lg">{routine.title}</CardTitle>
                    </div>
                    <Badge variant={routine.status === "active" ? "default" : "secondary"} className="text-xs">
                      <StatusIcon className="w-3 h-3 mr-1" />
                      {statusLabels[routine.status]}
                    </Badge>
                  </div>
                  <CardDescription className="line-clamp-2">
                    {routine.description || "暂无描述"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">状态</span>
                      <span>{statusLabels[routine.status] || routine.status}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">并发策略</span>
                      <span>{concurrencyLabels[routine.concurrencyPolicy] || routine.concurrencyPolicy}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">追赶策略</span>
                      <span>{catchUpLabels[routine.catchUpPolicy] || routine.catchUpPolicy}</span>
                    </div>
                    {routine.lastTriggeredAt && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">最后触发</span>
                        <span>{new Date(routine.lastTriggeredAt).toLocaleString()}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setSelectedRoutine(routine)}
                    >
                      详情
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => runMutation.mutate(routine.id)}
                    >
                      <Play className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditRoutine(routine)}
                    >
                      <Edit className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteRoutine(routine)}
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

      <RoutineDetailDialog
        routine={selectedRoutine}
        open={!!selectedRoutine}
        onClose={() => setSelectedRoutine(null)}
      />

      <CreateEditRoutineDialog
        open={createDialogOpen || !!editRoutine}
        routine={editRoutine}
        onClose={() => {
          setCreateDialogOpen(false);
          setEditRoutine(null);
        }}
        onSubmit={(data) => {
          if (editRoutine) {
            updateMutation.mutate({ routineId: editRoutine.id, data });
          } else {
            createMutation.mutate(data);
          }
        }}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      <DeleteRoutineDialog
        routine={deleteRoutine}
        open={!!deleteRoutine}
        onClose={() => setDeleteRoutine(null)}
        onConfirm={() => deleteRoutine && deleteMutation.mutate(deleteRoutine.id)}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}

interface RoutineDetailDialogProps {
  routine: Routine | null;
  open: boolean;
  onClose: () => void;
}

function RoutineDetailDialog({ routine, open, onClose }: RoutineDetailDialogProps) {
  const { selectedCompanyId } = useCompany();
  const { data: routineDetail } = useQuery({
    queryKey: queryKeys.routines.detail(selectedCompanyId!, routine?.id || ""),
    queryFn: () => routinesApi.get(routine!.id),
    enabled: !!routine?.id && !!selectedCompanyId && open,
  });

  if (!routine) return null;

  const triggers = routineDetail?.triggers || [];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{routine.title}</DialogTitle>
          <DialogDescription>{routine.description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <h4 className="text-sm font-medium mb-2">触发器 ({triggers.length})</h4>
            {triggers.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无触发器</p>
            ) : (
              <div className="space-y-2">
                {triggers.map((trigger: RoutineTrigger) => (
                  <div key={trigger.id} className="flex items-center justify-between p-2 bg-muted rounded">
                    <span className="text-sm">{triggerTypeLabels[trigger.kind]}</span>
                    {trigger.cronExpression && <code className="text-xs">{trigger.cronExpression}</code>}
                    {trigger.publicId && (
                      <code className="text-xs truncate max-w-[200px]">{trigger.publicId}</code>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <h4 className="text-sm font-medium mb-2">策略</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">并发:</span> {concurrencyLabels[routine.concurrencyPolicy]}
              </div>
              <div>
                <span className="text-muted-foreground">追赶:</span> {catchUpLabels[routine.catchUpPolicy]}
              </div>
            </div>
          </div>
          {routine.lastTriggeredAt && (
            <div>
              <h4 className="text-sm font-medium mb-2">最后触发</h4>
              <p className="text-sm text-muted-foreground">{new Date(routine.lastTriggeredAt).toLocaleString()}</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>关闭</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface CreateEditRoutineDialogProps {
  open: boolean;
  routine: Routine | null;
  onClose: () => void;
  onSubmit: (data: any) => void;
  isLoading: boolean;
}

function CreateEditRoutineDialog({ open, routine, onClose, onSubmit, isLoading }: CreateEditRoutineDialogProps) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    status: "active" as "active" | "paused" | "completed" | "archived",
    concurrencyPolicy: "coalesce_if_active" as "coalesce_if_active" | "allow_multiple" | "skip_if_active",
    catchUpPolicy: "skip_missed" as "skip_missed" | "run_all_missed" | "run_latest_only",
  });

  useEffect(() => {
    if (routine) {
      setFormData({
        title: routine.title,
        description: routine.description || "",
        status: routine.status,
        concurrencyPolicy: routine.concurrencyPolicy,
        catchUpPolicy: routine.catchUpPolicy,
      });
    } else {
      setFormData({
        title: "",
        description: "",
        status: "active",
        concurrencyPolicy: "coalesce_if_active",
        catchUpPolicy: "skip_missed",
      });
    }
  }, [routine, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{routine ? "编辑任务" : "创建任务"}</DialogTitle>
          <DialogDescription>
            {routine ? "更新例行任务配置" : "创建新的自动化任务"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">名称</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="任务名称"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">描述</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="任务描述..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">状态</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: any) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">活跃</SelectItem>
                    <SelectItem value="paused">暂停</SelectItem>
                    <SelectItem value="completed">已完成</SelectItem>
                    <SelectItem value="archived">已归档</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="concurrencyPolicy">并发策略</Label>
                <Select
                  value={formData.concurrencyPolicy}
                  onValueChange={(value: any) => setFormData({ ...formData, concurrencyPolicy: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="coalesce_if_active">合并</SelectItem>
                    <SelectItem value="allow_multiple">多实例</SelectItem>
                    <SelectItem value="skip_if_active">跳过</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="catchUpPolicy">追赶策略</Label>
              <Select
                value={formData.catchUpPolicy}
                onValueChange={(value: any) => setFormData({ ...formData, catchUpPolicy: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="skip_missed">跳过</SelectItem>
                  <SelectItem value="run_all_missed">全部执行</SelectItem>
                  <SelectItem value="run_latest_only">仅最新</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {routine ? "更新" : "创建"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface DeleteRoutineDialogProps {
  routine: Routine | null;
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading: boolean;
}

function DeleteRoutineDialog({ routine, open, onClose, onConfirm, isLoading }: DeleteRoutineDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>确认删除</DialogTitle>
          <DialogDescription>
            确定要删除例行任务"{routine?.title}"吗？此操作不可撤销。
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
