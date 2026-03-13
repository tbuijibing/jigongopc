// Type stubs for the module system API
// These will be replaced by @Jigongai/core types when the module system is implemented

export interface ModuleAPI {
  moduleId: string;
  config: Record<string, unknown>;
  db: any;
  registerRoutes(router: any): void;
  on(event: string, handler: (...args: any[]) => Promise<void>): void;
  registerService(service: ServiceDef): void;
  logger: { info: (...args: any[]) => void; error: (...args: any[]) => void; warn: (...args: any[]) => void };
  core: CoreServices;
}

export interface ServiceDef {
  name: string;
  interval: number;
  run(ctx: { db: any }): Promise<void>;
}

export interface CoreServices {
  agents: any;
  issues: any;
  projects: any;
  goals: any;
  activity: any;
}
