import type { ErrorRequestHandler } from "express";

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  const errorType = typeof error === "object" && error !== null && "type" in error
    ? (error as { type: unknown }).type
    : undefined;

  if (errorType === "entity.parse.failed") {
    response.status(400).json({ error: { code: "INVALID_JSON", message: "Request body contains invalid JSON." } });
    return;
  }

  if (errorType === "entity.too.large") {
    response.status(413).json({ error: { code: "PAYLOAD_TOO_LARGE", message: "Request body exceeds the allowed size." } });
    return;
  }

  if (errorType === "charset.unsupported" || errorType === "encoding.unsupported") {
    response.status(415).json({ error: { code: "UNSUPPORTED_JSON_ENCODING", message: "The request body encoding is not supported." } });
    return;
  }

  response.status(500).json({ error: { code: "INTERNAL_SERVER_ERROR", message: "An unexpected error occurred." } });
};
