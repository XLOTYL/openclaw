import fs from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";

export const OPENCLAW_BRIDGE_PROTO = "birtha.openclaw";
export const OPENCLAW_BRIDGE_VERSION = "1.0.0";

function loadJsonSchema(relativePath) {
  const schemaUrl = new URL(relativePath, import.meta.url);
  return JSON.parse(fs.readFileSync(schemaUrl, "utf8"));
}

function createSchemaValidator(relativePath) {
  const ajv = new Ajv2020({
    allErrors: true,
    strict: false,
    removeAdditional: false,
  });
  ajv.addFormat("uri", {
    type: "string",
    validate: (value) => URL.canParse(value),
  });
  return ajv.compile(loadJsonSchema(relativePath));
}

const validateGovernedInput = createSchemaValidator(
  "../../../../schemas/openclaw-bridge/v1/governed-openclaw-envelope-input.schema.json",
);
const validateWireEnvelope = createSchemaValidator(
  "../../../../schemas/openclaw-bridge/v1/openclaw-bridge-envelope.schema.json",
);

function normalizeValidationPath(error) {
  const instancePath = error.instancePath?.replace(/^\//, "").replace(/\//g, ".");
  if (instancePath && instancePath.length > 0) {
    return instancePath;
  }
  const missingProperty = error.params?.missingProperty;
  if (missingProperty) {
    return missingProperty;
  }
  return "<root>";
}

function formatValidationErrors(errors) {
  const lines = (errors ?? []).map((error) => {
    const path = normalizeValidationPath(error);
    return `${path}: ${error.message ?? "invalid"}`;
  });
  return lines.length > 0 ? lines.join("; ") : "invalid payload";
}

function trimOptionalString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function trimRequiredString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeGovernedEnvelopeInput(input) {
  return {
    sessionKey: trimRequiredString(input.sessionKey),
    channel: trimRequiredString(input.channel),
    sender: trimRequiredString(input.sender),
    engineeringSessionId: trimOptionalString(input.engineeringSessionId),
    taskId: trimOptionalString(input.taskId),
    runId: trimOptionalString(input.runId),
    dossierId: trimOptionalString(input.dossierId),
    idempotencyKey: trimRequiredString(input.idempotencyKey),
    attachments: input.attachments ? structuredClone(input.attachments) : undefined,
    clientCapabilities: input.clientCapabilities
      ? {
          streamingRequested: input.clientCapabilities.streamingRequested,
          maxPayloadBytes: input.clientCapabilities.maxPayloadBytes,
          maxInlineAttachmentBytes: input.clientCapabilities.maxInlineAttachmentBytes,
        }
      : undefined,
  };
}

export function assertGovernedOpenClawEnvelopeInput(input) {
  const normalized = normalizeGovernedEnvelopeInput(input);
  if (!validateGovernedInput(normalized)) {
    throw new Error(
      `birtha_query_openclaw_envelope_input: ${formatValidationErrors(validateGovernedInput.errors)}`,
    );
  }
  return normalized;
}

export function assertOpenClawBridgeEnvelope(envelope) {
  if (!validateWireEnvelope(envelope)) {
    throw new Error(
      `birtha_query_openclaw_envelope_wire: ${formatValidationErrors(validateWireEnvelope.errors)}`,
    );
  }
  return envelope;
}

export function buildOpenClawBridgeEnvelope(input) {
  const normalized = assertGovernedOpenClawEnvelopeInput(input);
  return assertOpenClawBridgeEnvelope({
    bridge: {
      proto: OPENCLAW_BRIDGE_PROTO,
      version: OPENCLAW_BRIDGE_VERSION,
    },
    session_key: normalized.sessionKey,
    channel: normalized.channel,
    sender: normalized.sender,
    ...(normalized.engineeringSessionId
      ? { engineering_session_id: normalized.engineeringSessionId }
      : {}),
    ...(normalized.taskId ? { task_id: normalized.taskId } : {}),
    ...(normalized.runId ? { run_id: normalized.runId } : {}),
    ...(normalized.dossierId ? { dossier_id: normalized.dossierId } : {}),
    idempotency_key: normalized.idempotencyKey,
    attachments: normalized.attachments ?? [],
    client_capabilities: normalized.clientCapabilities
      ? {
          ...(normalized.clientCapabilities.streamingRequested !== undefined
            ? { streaming_requested: normalized.clientCapabilities.streamingRequested }
            : {}),
          ...(normalized.clientCapabilities.maxPayloadBytes !== undefined
            ? { max_payload_bytes: normalized.clientCapabilities.maxPayloadBytes }
            : {}),
          ...(normalized.clientCapabilities.maxInlineAttachmentBytes !== undefined
            ? {
                max_inline_attachment_bytes: normalized.clientCapabilities.maxInlineAttachmentBytes,
              }
            : {}),
        }
      : {},
  });
}
