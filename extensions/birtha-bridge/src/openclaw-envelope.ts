import fs from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";

export const OPENCLAW_BRIDGE_PROTO = "birtha.openclaw";
export const OPENCLAW_BRIDGE_VERSION = "1.0.0";

export type OpenClawBridgeAttachment =
  | {
      kind: "url";
      url: string;
      title?: string;
    }
  | {
      kind: "storage_ref";
      ref: string;
      title?: string;
    }
  | {
      kind: "inline_base64";
      media_type: string;
      data: string;
      title?: string;
    };

export type GovernedOpenClawClientCapabilities = {
  streamingRequested?: boolean;
  maxPayloadBytes?: number;
  maxInlineAttachmentBytes?: number;
};

export type GovernedOpenClawEnvelopeInput = {
  sessionKey: string;
  channel: string;
  sender: string;
  engineeringSessionId?: string;
  taskId?: string;
  runId?: string;
  dossierId?: string;
  idempotencyKey: string;
  attachments?: OpenClawBridgeAttachment[];
  clientCapabilities?: GovernedOpenClawClientCapabilities;
};

export type OpenClawBridgeEnvelope = {
  bridge: {
    proto: typeof OPENCLAW_BRIDGE_PROTO;
    version: typeof OPENCLAW_BRIDGE_VERSION;
  };
  session_key: string;
  channel: string;
  sender: string;
  engineering_session_id?: string;
  task_id?: string;
  run_id?: string;
  dossier_id?: string;
  idempotency_key: string;
  attachments: OpenClawBridgeAttachment[];
  client_capabilities: {
    streaming_requested?: boolean;
    max_payload_bytes?: number;
    max_inline_attachment_bytes?: number;
  };
};

type ValidationIssue = {
  instancePath?: string;
  message?: string;
  params?: {
    missingProperty?: string;
  };
};

type Validator<T> = {
  (value: unknown): value is T;
  errors?: ValidationIssue[] | null;
};

function loadJsonSchema(relativePath: string): Record<string, unknown> {
  const schemaUrl = new URL(relativePath, import.meta.url);
  return JSON.parse(fs.readFileSync(schemaUrl, "utf8")) as Record<string, unknown>;
}

function createSchemaValidator<T>(relativePath: string): Validator<T> {
  const Ajv2020Ctor = Ajv2020 as unknown as {
    new (options: {
      allErrors: boolean;
      strict: boolean;
      removeAdditional: boolean;
    }): {
      addFormat: (name: string, format: { type: "string"; validate: (value: string) => boolean }) => void;
      compile: (schema: Record<string, unknown>) => Validator<T>;
    };
  };
  const ajv = new Ajv2020Ctor({
    allErrors: true,
    strict: false,
    removeAdditional: false,
  });
  ajv.addFormat("uri", {
    type: "string",
    validate: (value: string) => URL.canParse(value),
  });
  return ajv.compile(loadJsonSchema(relativePath)) as Validator<T>;
}

const validateGovernedInput = createSchemaValidator<GovernedOpenClawEnvelopeInput>(
  "../../../../schemas/openclaw-bridge/v1/governed-openclaw-envelope-input.schema.json",
);
const validateWireEnvelope = createSchemaValidator<OpenClawBridgeEnvelope>(
  "../../../../schemas/openclaw-bridge/v1/openclaw-bridge-envelope.schema.json",
);

function normalizeValidationPath(error: ValidationIssue): string {
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

function formatValidationErrors(errors: ValidationIssue[] | null | undefined): string {
  const lines = (errors ?? []).map((error) => {
    const path = normalizeValidationPath(error);
    return `${path}: ${error.message ?? "invalid"}`;
  });
  return lines.length > 0 ? lines.join("; ") : "invalid payload";
}

function trimOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function trimRequiredString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeGovernedEnvelopeInput(
  input: GovernedOpenClawEnvelopeInput,
): GovernedOpenClawEnvelopeInput {
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

export function assertGovernedOpenClawEnvelopeInput(
  input: GovernedOpenClawEnvelopeInput,
): GovernedOpenClawEnvelopeInput {
  const normalized = normalizeGovernedEnvelopeInput(input);
  if (!validateGovernedInput(normalized)) {
    throw new Error(
      `birtha_query_openclaw_envelope_input: ${formatValidationErrors(validateGovernedInput.errors)}`,
    );
  }
  return normalized;
}

export function assertOpenClawBridgeEnvelope(
  envelope: OpenClawBridgeEnvelope,
): OpenClawBridgeEnvelope {
  if (!validateWireEnvelope(envelope)) {
    throw new Error(
      `birtha_query_openclaw_envelope_wire: ${formatValidationErrors(validateWireEnvelope.errors)}`,
    );
  }
  return envelope;
}

export function buildOpenClawBridgeEnvelope(
  input: GovernedOpenClawEnvelopeInput,
): OpenClawBridgeEnvelope {
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
