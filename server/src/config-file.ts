import fs from "node:fs";
import { JigongConfigSchema, type JiGongConfig } from "@jigongai/shared";
import { resolveJiGongConfigPath } from "./paths.js";

export function readConfigFile(): JiGongConfig | null {
  const configPath = resolveJiGongConfigPath();

  if (!fs.existsSync(configPath)) return null;

  try {
    const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    return JigongConfigSchema.parse(raw);
  } catch {
    return null;
  }
}
