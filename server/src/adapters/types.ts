// Re-export all types from the shared adapter-utils package.
// This file is kept as a convenience shim so existing in-tree
// imports (process/, http/, heartbeat.ts) don't need rewriting.
export type {
  AdapterAgent,
  AdapterRuntime,
  UsageSummary,
  AdapterExecutionResult,
  AdapterInvocationMeta,
  AdapterExecutionContext,
  AdapterEnvironmentCheckLevel,
  AdapterEnvironmentCheck,
  AdapterEnvironmentTestStatus,
  AdapterEnvironmentTestResult,
  AdapterEnvironmentTestContext,
  AdapterSessionCodec,
  AdapterModel,
  ServerAdapterModule,
} from "@jigongai/adapter-utils";

// ---------------------------------------------------------------------------
// Adapter Context Injection types (Requirements 7.1, 7.6)
// ---------------------------------------------------------------------------

/** Declares which injection methods an adapter supports. */
export interface AdapterInjectionCapabilities {
  supportsSoulInjection: boolean;
  supportsSkillInjection: boolean;
  supportsMemoryInjection: boolean;
  supportsToolInjection: boolean;
}

/** Result of a single injection operation. */
export type InjectionResult =
  | { type: "file"; path: string; content: string }
  | { type: "prompt"; content: string }
  | { type: "config"; key: string; value: unknown }
  | { type: "noop"; reason: string };

/** Interface for adapter context injection (soul, skills, memories, tools). */
export interface AdapterContextInjection {
  getCapabilities(): AdapterInjectionCapabilities;
  prepareSoul(soul: unknown): Promise<InjectionResult>;
  prepareSkills(skills: unknown[]): Promise<InjectionResult>;
  prepareMemories(memories: unknown[]): Promise<InjectionResult>;
  prepareTools(tools: unknown[]): Promise<InjectionResult>;
}
