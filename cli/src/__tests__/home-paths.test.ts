import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  describeLocalInstancePaths,
  expandHomePrefix,
  resolveJiGongHomeDir,
  resolveJiGongInstanceId,
} from "../config/home.js";

const ORIGINAL_ENV = { ...process.env };

describe("home path resolution", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("defaults to ~/.jigong and default instance", () => {
    delete process.env.Jigong_HOME;
    delete process.env.Jigong_INSTANCE_ID;

    const paths = describeLocalInstancePaths();
    expect(paths.homeDir).toBe(path.resolve(os.homedir(), ".jigong"));
    expect(paths.instanceId).toBe("default");
    expect(paths.configPath).toBe(path.resolve(os.homedir(), ".jigong", "instances", "default", "config.json"));
  });

  it("supports Jigong_HOME and explicit instance ids", () => {
    process.env.Jigong_HOME = "~/jigong-home";

    const home = resolveJiGongHomeDir();
    expect(home).toBe(path.resolve(os.homedir(), "jigong-home"));
    expect(resolveJiGongInstanceId("dev_1")).toBe("dev_1");
  });

  it("rejects invalid instance ids", () => {
    expect(() => resolveJiGongInstanceId("bad/id")).toThrow(/Invalid instance id/);
  });

  it("expands ~ prefixes", () => {
    expect(expandHomePrefix("~")).toBe(os.homedir());
    expect(expandHomePrefix("~/x/y")).toBe(path.resolve(os.homedir(), "x/y"));
  });
});
