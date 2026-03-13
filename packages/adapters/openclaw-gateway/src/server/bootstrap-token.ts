import { createHmac, randomUUID } from "node:crypto";

export interface BootstrapTokenParams {
  agentId: string;
  companyId: string;
  runId: string;
  ttlSeconds?: number;
  signingKey: string;
}

const DEFAULT_TTL_SECONDS = 600;

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function signHmac256(secret: string, input: string): string {
  return createHmac("sha256", secret).update(input).digest("base64url");
}

/**
 * Mint a short-lived bootstrap JWT for an OpenClaw agent run.
 *
 * The token binds agentId, companyId and runId together with a unique jti
 * so the exchange endpoint can enforce one-time use.
 */
export function mintBootstrapToken(params: BootstrapTokenParams): string {
  const ttl = params.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: "HS256", typ: "JWT" };

  const payload = {
    sub: params.agentId,
    aud: "Jigong:bootstrap",
    iss: "Jigong",
    cid: params.companyId,
    rid: params.runId,
    iat: now,
    exp: now + ttl,
    jti: randomUUID(),
  };

  const signingInput = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`;
  const signature = signHmac256(params.signingKey, signingInput);

  return `${signingInput}.${signature}`;
}
