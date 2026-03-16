// ─── Types ───────────────────────────────────────────────────────────────────

export interface StructuredWakePayload {
  version: 2;
  auth: {
    method: "bootstrap_exchange" | "api_key_file";
    exchangeUrl?: string;
    bootstrapToken?: string;
    apiKeyFilePath?: string;
  };
  skills: {
    indexUrl: string;
    required: string[];
    agentSkills?: {
      name: string;
      slug: string;
      content: string;
      category: string;
      version: string;
      source?: string;
    }[];
  };
  run: {
    runId: string;
    agentId: string;
    companyId: string;
    taskId?: string;
    issueId?: string;
    wakeReason?: string;
    wakeCommentId?: string;
    approvalId?: string;
    approvalStatus?: string;
    linkedIssueIds: string[];
  };
  api: {
    baseUrl: string;
    headers: Record<string, string>;
  };
  workflow: string[];
}

const DEFAULT_API_KEY_FILE_PATH = "~/.openclaw/workspace/Jigong-claimed-api-key.json";

// ─── Builder ─────────────────────────────────────────────────────────────────

export function buildWakePayloadV2(params: {
  runId: string;
  agentId: string;
  companyId: string;
  JigongApiUrl: string;
  bootstrapToken: string | null;
  taskId?: string | null;
  issueId?: string | null;
  wakeReason?: string | null;
  wakeCommentId?: string | null;
  approvalId?: string | null;
  approvalStatus?: string | null;
  linkedIssueIds?: string[];
  // Optional agent skills to include in payload
  agentSkills?: {
    name: string;
    slug: string;
    content: string;
    category: string;
    version: string;
    source?: string;
  }[];
}): { payload: StructuredWakePayload; message: string } {
  const baseUrl = params.JigongApiUrl;

  const auth: StructuredWakePayload["auth"] = params.bootstrapToken
    ? {
        method: "bootstrap_exchange",
        exchangeUrl: `${baseUrl}/api/agent-auth/exchange`,
        bootstrapToken: params.bootstrapToken,
      }
    : {
        method: "api_key_file",
        apiKeyFilePath: DEFAULT_API_KEY_FILE_PATH,
      };

  const skills: StructuredWakePayload["skills"] = {
    indexUrl: `${baseUrl}/api/skills/index`,
    required: ["Jigong"],
    agentSkills: params.agentSkills,
  };

  const run: StructuredWakePayload["run"] = {
    runId: params.runId,
    agentId: params.agentId,
    companyId: params.companyId,
    linkedIssueIds: params.linkedIssueIds ?? [],
  };
  if (params.taskId) run.taskId = params.taskId;
  if (params.issueId) run.issueId = params.issueId;
  if (params.wakeReason) run.wakeReason = params.wakeReason;
  if (params.wakeCommentId) run.wakeCommentId = params.wakeCommentId;
  if (params.approvalId) run.approvalId = params.approvalId;
  if (params.approvalStatus) run.approvalStatus = params.approvalStatus;

  const api: StructuredWakePayload["api"] = {
    baseUrl,
    headers: {
      "x-Jigong-run-id": params.runId,
    },
  };

  const workflow = [
    "1. Authenticate using the auth block (exchange bootstrap token or load API key file)",
    "2. Fetch skill index from skills.indexUrl and load required skills",
    "3. Follow the Jigong skill workflow to execute the assigned task",
  ];

  const payload: StructuredWakePayload = {
    version: 2,
    auth,
    skills,
    run,
    api,
    workflow,
  };

  const message = buildMessage(params);

  return { payload, message };
}

// ─── Message builder ─────────────────────────────────────────────────────────

function buildMessage(params: {
  runId: string;
  agentId: string;
  companyId: string;
  bootstrapToken: string | null;
  taskId?: string | null;
  issueId?: string | null;
  wakeReason?: string | null;
}): string {
  const lines: string[] = [
    "JiGong structured wake (v2). Refer to the attached payload for full context.",
    "",
  ];

  if (params.wakeReason) {
    lines.push(`Wake reason: ${params.wakeReason}`);
  }

  const targetId = params.taskId ?? params.issueId;
  if (targetId) {
    lines.push(`Target: ${targetId}`);
  }

  lines.push(`Run: ${params.runId}`);

  if (params.bootstrapToken) {
    lines.push("Auth: exchange bootstrap token via payload.auth.exchangeUrl");
  } else {
    lines.push("Auth: load API key from payload.auth.apiKeyFilePath");
  }

  lines.push("", "Follow payload.workflow steps to complete this run.");

  return lines.join("\n");
}
