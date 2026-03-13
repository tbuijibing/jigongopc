import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  agentSixDimensionApi,
  type SkillRegistryEntry,
  type CreateSkillInput,
} from "../api/agent-six-dimensions";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { PageSkeleton } from "../components/PageSkeleton";
import { EmptyState } from "../components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles, Plus, Loader2, X, Search } from "lucide-react";

const SKILL_CATEGORIES = [
  "general",
  "coding",
  "testing",
  "devops",
  "documentation",
  "communication",
  "analysis",
  "design",
] as const;

const emptyForm: CreateSkillInput = {
  name: "",
  slug: "",
  description: "",
  content: "",
  category: "general",
  version: "1.0.0",
  author: "",
};

export function SkillStore() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();

  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [nameSearch, setNameSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateSkillInput>({ ...emptyForm });
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setBreadcrumbs([{ label: "Skills" }]);
  }, [setBreadcrumbs]);

  const { data: skills, isLoading, error } = useQuery({
    queryKey: queryKeys.skillStore(selectedCompanyId!),
    queryFn: () => agentSixDimensionApi.listSkillStore(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const registerMutation = useMutation({
    mutationFn: (data: CreateSkillInput) =>
      agentSixDimensionApi.registerSkill(selectedCompanyId!, data),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.skillStore(selectedCompanyId!) });
      setShowForm(false);
      setForm({ ...emptyForm });
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : "Failed to register skill");
    },
  });

  const filtered = useMemo(() => {
    if (!skills) return [];
    let result = skills;
    if (categoryFilter !== "all") {
      result = result.filter((s) => s.category === categoryFilter);
    }
    if (nameSearch.trim()) {
      const q = nameSearch.trim().toLowerCase();
      result = result.filter((s) => s.name.toLowerCase().includes(q));
    }
    return result;
  }, [skills, categoryFilter, nameSearch]);

  function handleRegister() {
    registerMutation.mutate(form);
  }

  if (!selectedCompanyId) {
    return <EmptyState icon={Sparkles} message="Select a company to view the Skill Store." />;
  }

  if (isLoading) {
    return <PageSkeleton variant="list" />;
  }

  if (error) {
    return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold">Skill Store</h2>
        <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Register New Skill
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by name…"
            value={nameSearch}
            onChange={(e) => setNameSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40 h-9">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {SKILL_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Error banner */}
      {actionError && <p className="text-sm text-destructive">{actionError}</p>}

      {/* Register form */}
      {showForm && (
        <div className="rounded-lg border border-border p-4 space-y-4 max-w-2xl">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Register New Skill</h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => { setShowForm(false); setForm({ ...emptyForm }); setActionError(null); }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="skill-name">Name</Label>
              <Input
                id="skill-name"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="My Skill"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="skill-slug">Slug</Label>
              <Input
                id="skill-slug"
                value={form.slug}
                onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))}
                placeholder="my-skill"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="skill-desc">Description</Label>
            <Input
              id="skill-desc"
              value={form.description ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="What this skill does"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="skill-content">Content (Markdown)</Label>
            <Textarea
              id="skill-content"
              rows={6}
              value={form.content}
              onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
              placeholder="# Skill instructions&#10;&#10;Describe the skill behavior in Markdown…"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="skill-category">Category</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm((p) => ({ ...p, category: v }))}
              >
                <SelectTrigger id="skill-category" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SKILL_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="skill-version">Version</Label>
              <Input
                id="skill-version"
                value={form.version ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, version: e.target.value }))}
                placeholder="1.0.0"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="skill-author">Author</Label>
              <Input
                id="skill-author"
                value={form.author ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, author: e.target.value }))}
                placeholder="Author name"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleRegister}
              disabled={registerMutation.isPending || !form.name.trim() || !form.slug.trim() || !form.content.trim()}
            >
              {registerMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Register
            </Button>
            <Button
              variant="ghost"
              onClick={() => { setShowForm(false); setForm({ ...emptyForm }); setActionError(null); }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Skills list */}
      {filtered.length > 0 ? (
        <div className="space-y-2">
          {filtered.map((skill) => (
            <div
              key={skill.id}
              className="rounded-lg border border-border p-3 space-y-1"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium">{skill.name}</p>
                <Badge variant="secondary">{skill.category}</Badge>
                {skill.isBuiltin && <Badge variant="default">Built-in</Badge>}
                <span className="text-xs text-muted-foreground">v{skill.version}</span>
                {skill.author && (
                  <span className="text-xs text-muted-foreground">by {skill.author}</span>
                )}
              </div>
              {skill.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">{skill.description}</p>
              )}
            </div>
          ))}
        </div>
      ) : skills && skills.length > 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          No skills match the current filters.
        </p>
      ) : (
        <EmptyState
          icon={Sparkles}
          message="No skills registered yet."
          action="Register New Skill"
          onAction={() => setShowForm(true)}
        />
      )}
    </div>
  );
}
