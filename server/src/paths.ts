import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { resolveDefaultConfigPath } from "./home-paths.js";

const Jigong_CONFIG_BASENAME = "config.json";
const Jigong_ENV_FILENAME = ".env";

function findConfigFileFromAncestors(startDir: string): string | null {
  const absoluteStartDir = path.resolve(startDir);
  let currentDir = absoluteStartDir;

  while (true) {
    const candidate = path.resolve(currentDir, ".jigong", Jigong_CONFIG_BASENAME);
    if (fs.existsSync(candidate)) {
      return candidate;
    }

    const nextDir = path.resolve(currentDir, "..");
    if (nextDir === currentDir) break;
    currentDir = nextDir;
  }

  return null;
}

export function resolveJiGongConfigPath(overridePath?: string): string {
  if (overridePath) return path.resolve(overridePath);
  if (process.env.Jigong_CONFIG) return path.resolve(process.env.Jigong_CONFIG);
  return findConfigFileFromAncestors(process.cwd()) ?? resolveDefaultConfigPath();
}

export function resolveJiGongEnvPath(overrideConfigPath?: string): string {
  // First, check if there's a .env file in the project root
  // Since server code runs from server/ directory, we need to check parent directory
  const projectRootEnv = path.resolve(process.cwd(), "..", Jigong_ENV_FILENAME);
  if (fs.existsSync(projectRootEnv)) {
    return projectRootEnv;
  }
  
  // Also check current working directory for .env file
  const cwdEnv = path.resolve(process.cwd(), Jigong_ENV_FILENAME);
  if (fs.existsSync(cwdEnv)) {
    return cwdEnv;
  }
  
  // Fall back to the config directory location
  const configPath = resolveJiGongConfigPath(overrideConfigPath);
  const configDir = path.dirname(configPath);
  return path.resolve(configDir, Jigong_ENV_FILENAME);
}
