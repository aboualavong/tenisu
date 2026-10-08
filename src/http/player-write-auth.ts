import { timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";

export function createPlayerWriteAuth(apiKey: string | undefined): RequestHandler {
  return (request, response, next) => {
    if (request.method !== "POST" || !/^\/players\/?$/i.test(request.path)) {
      next();
      return;
    }

    const expectedKey = apiKey?.trim();
    if (!expectedKey || Buffer.byteLength(expectedKey, "utf8") < 32) {
      response.status(503).json({
        error: { code: "PLAYER_CREATION_DISABLED", message: "Player creation requires a configured API key of at least 32 bytes." },
      });
      return;
    }

    const suppliedKey = request.get("x-api-key");
    if (!suppliedKey || !keysMatch(suppliedKey, expectedKey)) {
      response.status(401).json({ error: { code: "UNAUTHORIZED", message: "A valid API key is required." } });
      return;
    }

    next();
  };
}

function keysMatch(suppliedKey: string, expectedKey: string): boolean {
  const supplied = Buffer.from(suppliedKey, "utf8");
  const expected = Buffer.from(expectedKey, "utf8");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
