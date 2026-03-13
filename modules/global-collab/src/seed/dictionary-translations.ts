/**
 * Dictionary translations seed data.
 *
 * Covers all 17 enum categories from packages/shared/src/constants.ts
 * plus module-defined categories (notification_type, presence_status).
 *
 * English labels reuse AGENT_ROLE_LABELS where available and derive
 * human-readable labels for the rest (e.g. "in_progress" → "In Progress").
 */
import { AGENT_ROLE_LABELS } from "@Jigongai/shared/constants";
import { modGlobalCollabDictionaryTranslations } from "../schema.js";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SeedEntry {
  category: string;
  key: string;
  locale: string;
  label: string;
}

// ─── Helper ─────────────────────────────────────────────────────────────────

/** Expand a compact { key → { locale → label } } map into flat SeedEntry[] */
function entries(
  category: string,
  translations: Record<string, Record<string, string>>,
): SeedEntry[] {
  const result: SeedEntry[] = [];
  for (const [key, locales] of Object.entries(translations)) {
    for (const [locale, label] of Object.entries(locales)) {
      result.push({ category, key, locale, label });
    }
  }
  return result;
}

// ─── Seed Data ──────────────────────────────────────────────────────────────

export const DICTIONARY_SEED_DATA: SeedEntry[] = [
  // ── 1. issue_status ─────────────────────────────────────────────────────
  ...entries("issue_status", {
    backlog: {
      en: "Backlog", "zh-CN": "待办", ja: "バックログ", ko: "백로그",
      es: "Pendiente", fr: "En attente", de: "Backlog", "pt-BR": "Backlog",
    },
    todo: {
      en: "Todo", "zh-CN": "待处理", ja: "未着手", ko: "할 일",
      es: "Por hacer", fr: "À faire", de: "Zu erledigen", "pt-BR": "A fazer",
    },
    in_progress: {
      en: "In Progress", "zh-CN": "进行中", ja: "進行中", ko: "진행 중",
      es: "En progreso", fr: "En cours", de: "In Bearbeitung", "pt-BR": "Em andamento",
    },
    in_review: {
      en: "In Review", "zh-CN": "审核中", ja: "レビュー中", ko: "검토 중",
      es: "En revisión", fr: "En revue", de: "In Überprüfung", "pt-BR": "Em revisão",
    },
    done: {
      en: "Done", "zh-CN": "已完成", ja: "完了", ko: "완료",
      es: "Hecho", fr: "Terminé", de: "Erledigt", "pt-BR": "Concluído",
    },
    blocked: {
      en: "Blocked", "zh-CN": "已阻塞", ja: "ブロック", ko: "차단됨",
      es: "Bloqueado", fr: "Bloqué", de: "Blockiert", "pt-BR": "Bloqueado",
    },
    cancelled: {
      en: "Cancelled", "zh-CN": "已取消", ja: "キャンセル", ko: "취소됨",
      es: "Cancelado", fr: "Annulé", de: "Abgebrochen", "pt-BR": "Cancelado",
    },
  }),

  // ── 2. issue_priority ───────────────────────────────────────────────────
  ...entries("issue_priority", {
    critical: {
      en: "Critical", "zh-CN": "紧急", ja: "緊急", ko: "긴급",
      es: "Crítico", fr: "Critique", de: "Kritisch", "pt-BR": "Crítico",
    },
    high: {
      en: "High", "zh-CN": "高", ja: "高", ko: "높음",
      es: "Alto", fr: "Élevé", de: "Hoch", "pt-BR": "Alto",
    },
    medium: {
      en: "Medium", "zh-CN": "中", ja: "中", ko: "보통",
      es: "Medio", fr: "Moyen", de: "Mittel", "pt-BR": "Médio",
    },
    low: {
      en: "Low", "zh-CN": "低", ja: "低", ko: "낮음",
      es: "Bajo", fr: "Faible", de: "Niedrig", "pt-BR": "Baixo",
    },
  }),

  // ── 3. agent_status ─────────────────────────────────────────────────────
  ...entries("agent_status", {
    active: {
      en: "Active", "zh-CN": "活跃", ja: "アクティブ", ko: "활성",
      es: "Activo", fr: "Actif", de: "Aktiv", "pt-BR": "Ativo",
    },
    paused: {
      en: "Paused", "zh-CN": "已暂停", ja: "一時停止", ko: "일시정지",
      es: "Pausado", fr: "En pause", de: "Pausiert", "pt-BR": "Pausado",
    },
    idle: {
      en: "Idle", "zh-CN": "空闲", ja: "アイドル", ko: "유휴",
      es: "Inactivo", fr: "Inactif", de: "Leerlauf", "pt-BR": "Ocioso",
    },
    running: {
      en: "Running", "zh-CN": "运行中", ja: "実行中", ko: "실행 중",
      es: "Ejecutando", fr: "En cours", de: "Läuft", "pt-BR": "Executando",
    },
    error: {
      en: "Error", "zh-CN": "错误", ja: "エラー", ko: "오류",
      es: "Error", fr: "Erreur", de: "Fehler", "pt-BR": "Erro",
    },
    pending_approval: {
      en: "Pending Approval", "zh-CN": "待审批", ja: "承認待ち", ko: "승인 대기",
      es: "Pendiente de aprobación", fr: "En attente d'approbation", de: "Genehmigung ausstehend", "pt-BR": "Aguardando aprovação",
    },
    terminated: {
      en: "Terminated", "zh-CN": "已终止", ja: "終了", ko: "종료됨",
      es: "Terminado", fr: "Terminé", de: "Beendet", "pt-BR": "Encerrado",
    },
  }),

  // ── 4. agent_role (en from AGENT_ROLE_LABELS) ────────────────────────────
  ...entries("agent_role", {
    ceo: {
      en: AGENT_ROLE_LABELS.ceo, "zh-CN": "首席执行官", ja: "CEO", ko: "CEO",
      es: "CEO", fr: "PDG", de: "CEO", "pt-BR": "CEO",
    },
    cto: {
      en: AGENT_ROLE_LABELS.cto, "zh-CN": "首席技术官", ja: "CTO", ko: "CTO",
      es: "CTO", fr: "CTO", de: "CTO", "pt-BR": "CTO",
    },
    cmo: {
      en: AGENT_ROLE_LABELS.cmo, "zh-CN": "首席营销官", ja: "CMO", ko: "CMO",
      es: "CMO", fr: "CMO", de: "CMO", "pt-BR": "CMO",
    },
    cfo: {
      en: AGENT_ROLE_LABELS.cfo, "zh-CN": "首席财务官", ja: "CFO", ko: "CFO",
      es: "CFO", fr: "CFO", de: "CFO", "pt-BR": "CFO",
    },
    engineer: {
      en: AGENT_ROLE_LABELS.engineer, "zh-CN": "工程师", ja: "エンジニア", ko: "엔지니어",
      es: "Ingeniero", fr: "Ingénieur", de: "Ingenieur", "pt-BR": "Engenheiro",
    },
    designer: {
      en: AGENT_ROLE_LABELS.designer, "zh-CN": "设计师", ja: "デザイナー", ko: "디자이너",
      es: "Diseñador", fr: "Designer", de: "Designer", "pt-BR": "Designer",
    },
    pm: {
      en: AGENT_ROLE_LABELS.pm, "zh-CN": "产品经理", ja: "PM", ko: "PM",
      es: "PM", fr: "Chef de projet", de: "PM", "pt-BR": "PM",
    },
    qa: {
      en: AGENT_ROLE_LABELS.qa, "zh-CN": "质量保证", ja: "QA", ko: "QA",
      es: "QA", fr: "QA", de: "QA", "pt-BR": "QA",
    },
    devops: {
      en: AGENT_ROLE_LABELS.devops, "zh-CN": "运维工程师", ja: "DevOps", ko: "DevOps",
      es: "DevOps", fr: "DevOps", de: "DevOps", "pt-BR": "DevOps",
    },
    researcher: {
      en: AGENT_ROLE_LABELS.researcher, "zh-CN": "研究员", ja: "リサーチャー", ko: "연구원",
      es: "Investigador", fr: "Chercheur", de: "Forscher", "pt-BR": "Pesquisador",
    },
    general: {
      en: AGENT_ROLE_LABELS.general, "zh-CN": "通用", ja: "汎用", ko: "일반",
      es: "General", fr: "Général", de: "Allgemein", "pt-BR": "Geral",
    },
  }),

  // ── 5. agent_adapter_type ───────────────────────────────────────────────
  ...entries("agent_adapter_type", {
    process:           { en: "Process",           "zh-CN": "进程" },
    http:              { en: "HTTP",              "zh-CN": "HTTP" },
    claude_local:      { en: "Claude Local",      "zh-CN": "Claude 本地" },
    codex_local:       { en: "Codex Local",       "zh-CN": "Codex 本地" },
    opencode_local:    { en: "OpenCode Local",    "zh-CN": "OpenCode 本地" },
    pi_local:          { en: "Pi Local",          "zh-CN": "Pi 本地" },
    cursor:            { en: "Cursor",            "zh-CN": "Cursor" },
    openclaw_gateway:  { en: "OpenClaw Gateway",  "zh-CN": "OpenClaw 网关" },
  }),

  // ── 6. company_status ───────────────────────────────────────────────────
  ...entries("company_status", {
    active:   { en: "Active",   "zh-CN": "活跃",   ja: "アクティブ", ko: "활성" },
    paused:   { en: "Paused",   "zh-CN": "已暂停", ja: "一時停止",   ko: "일시정지" },
    archived: { en: "Archived", "zh-CN": "已归档", ja: "アーカイブ", ko: "보관됨" },
  }),

  // ── 7. project_status ───────────────────────────────────────────────────
  ...entries("project_status", {
    backlog:     { en: "Backlog",     "zh-CN": "待办",   ja: "バックログ", ko: "백로그" },
    planned:     { en: "Planned",     "zh-CN": "已计划", ja: "計画済み",   ko: "계획됨" },
    in_progress: { en: "In Progress", "zh-CN": "进行中", ja: "進行中",     ko: "진행 중" },
    completed:   { en: "Completed",   "zh-CN": "已完成", ja: "完了",       ko: "완료" },
    cancelled:   { en: "Cancelled",   "zh-CN": "已取消", ja: "キャンセル", ko: "취소됨" },
  }),

  // ── 8. goal_level ─────────────────────────────────────────────────────
  ...entries("goal_level", {
    company: { en: "Company", "zh-CN": "公司", ja: "会社",     ko: "회사" },
    team:    { en: "Team",    "zh-CN": "团队", ja: "チーム",   ko: "팀" },
    agent:   { en: "Agent",   "zh-CN": "代理", ja: "エージェント", ko: "에이전트" },
    task:    { en: "Task",    "zh-CN": "任务", ja: "タスク",   ko: "태스크" },
  }),

  // ── 9. goal_status ──────────────────────────────────────────────────────
  ...entries("goal_status", {
    planned:   { en: "Planned",   "zh-CN": "已计划", ja: "計画済み",   ko: "계획됨" },
    active:    { en: "Active",    "zh-CN": "进行中", ja: "アクティブ", ko: "활성" },
    achieved:  { en: "Achieved",  "zh-CN": "已达成", ja: "達成",       ko: "달성됨" },
    cancelled: { en: "Cancelled", "zh-CN": "已取消", ja: "キャンセル", ko: "취소됨" },
  }),

  // ── 10. approval_type ───────────────────────────────────────────────────
  ...entries("approval_type", {
    hire_agent:           { en: "Hire Agent",           "zh-CN": "招聘代理" },
    approve_ceo_strategy: { en: "Approve CEO Strategy", "zh-CN": "审批CEO战略" },
  }),

  // ── 11. approval_status ─────────────────────────────────────────────────
  ...entries("approval_status", {
    pending:            { en: "Pending",            "zh-CN": "待处理",   ja: "保留中",     ko: "대기 중" },
    revision_requested: { en: "Revision Requested", "zh-CN": "要求修改", ja: "修正依頼",   ko: "수정 요청" },
    approved:           { en: "Approved",           "zh-CN": "已批准",   ja: "承認済み",   ko: "승인됨" },
    rejected:           { en: "Rejected",           "zh-CN": "已拒绝",   ja: "却下",       ko: "거부됨" },
    cancelled:          { en: "Cancelled",          "zh-CN": "已取消",   ja: "キャンセル", ko: "취소됨" },
  }),

  // ── 12. heartbeat_run_status ────────────────────────────────────────────
  ...entries("heartbeat_run_status", {
    queued:    { en: "Queued",    "zh-CN": "排队中" },
    running:   { en: "Running",   "zh-CN": "运行中" },
    succeeded: { en: "Succeeded", "zh-CN": "已成功" },
    failed:    { en: "Failed",    "zh-CN": "已失败" },
    cancelled: { en: "Cancelled", "zh-CN": "已取消" },
    timed_out: { en: "Timed Out", "zh-CN": "已超时" },
  }),

  // ── 13. join_request_status ─────────────────────────────────────────────
  ...entries("join_request_status", {
    pending_approval: { en: "Pending Approval", "zh-CN": "待审批" },
    approved:         { en: "Approved",         "zh-CN": "已批准" },
    rejected:         { en: "Rejected",         "zh-CN": "已拒绝" },
  }),

  // ── 14. membership_status ───────────────────────────────────────────────
  ...entries("membership_status", {
    pending:   { en: "Pending",   "zh-CN": "待处理" },
    active:    { en: "Active",    "zh-CN": "活跃" },
    suspended: { en: "Suspended", "zh-CN": "已暂停" },
  }),

  // ── 15. notification_type (module-defined) ──────────────────────────────
  ...entries("notification_type", {
    mention:          { en: "Mention",          "zh-CN": "提及",     ja: "メンション", ko: "멘션" },
    assignment:       { en: "Assignment",       "zh-CN": "分配",     ja: "割り当て",   ko: "할당" },
    status_change:    { en: "Status Change",    "zh-CN": "状态变更", ja: "ステータス変更", ko: "상태 변경" },
    comment:          { en: "Comment",          "zh-CN": "评论",     ja: "コメント",   ko: "댓글" },
    handoff_request:  { en: "Handoff Request",  "zh-CN": "交接请求", ja: "引き継ぎ依頼", ko: "인수 요청" },
  }),

  // ── 16. presence_status (module-defined) ────────────────────────────────
  ...entries("presence_status", {
    online:  { en: "Online",  "zh-CN": "在线",   ja: "オンライン", ko: "온라인" },
    away:    { en: "Away",    "zh-CN": "离开",   ja: "離席",       ko: "자리 비움" },
    offline: { en: "Offline", "zh-CN": "离线",   ja: "オフライン", ko: "오프라인" },
  }),

  // ── 17. permission_key ──────────────────────────────────────────────────
  ...entries("permission_key", {
    "agents:create":              { en: "Create Agents",       "zh-CN": "创建代理" },
    "users:invite":               { en: "Invite Users",        "zh-CN": "邀请用户" },
    "users:manage_permissions":   { en: "Manage Permissions",  "zh-CN": "管理权限" },
    "tasks:assign":               { en: "Assign Tasks",        "zh-CN": "分配任务" },
    "tasks:assign_scope":         { en: "Assign Task Scope",   "zh-CN": "分配任务范围" },
    "joins:approve":              { en: "Approve Join Requests", "zh-CN": "审批加入请求" },
  }),
];

// ─── Seed Function ──────────────────────────────────────────────────────────

/**
 * Insert all dictionary translations into the database.
 * Uses `onConflictDoNothing` so the function is idempotent — safe to call
 * on every module load without duplicating rows.
 */
export async function seedDictionaryTranslations(db: any): Promise<number> {
  if (DICTIONARY_SEED_DATA.length === 0) return 0;

  // Batch insert in chunks of 200 to avoid oversized parameter lists
  const BATCH_SIZE = 200;
  let inserted = 0;

  for (let i = 0; i < DICTIONARY_SEED_DATA.length; i += BATCH_SIZE) {
    const batch = DICTIONARY_SEED_DATA.slice(i, i + BATCH_SIZE);
    const result = await db
      .insert(modGlobalCollabDictionaryTranslations)
      .values(
        batch.map((e) => ({
          category: e.category,
          key: e.key,
          locale: e.locale,
          label: e.label,
        })),
      )
      .onConflictDoNothing();

    inserted += result.rowCount ?? 0;
  }

  return inserted;
}
