import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as protocol from "./index.js";

type ParityCase = {
  method: string;
  validatorMethod: string;
  valid: Record<string, unknown>[];
  invalid: Record<string, unknown>[];
};

const corpus = JSON.parse(
  fs.readFileSync(
    path.resolve(
      import.meta.dirname,
      "../../../test/fixtures/openclaw-contract-parity-corpus.json",
    ),
    "utf8",
  ),
) as { cases: ParityCase[] };

const VALIDATOR_EXPORTS: Record<string, keyof typeof protocol> = {
  "sessions.list": "validateSessionsListParams",
  "sessions.preview": "validateSessionsPreviewParams",
  "sessions.get": "validateSessionsGetParams",
  "sessions.resolve": "validateSessionsResolveParams",
  "sessions.create": "validateSessionsCreateParams",
  "sessions.send": "validateSessionsSendParams",
  "sessions.abort": "validateSessionsAbortParams",
  "sessions.patch": "validateSessionsPatchParams",
  "sessions.reset": "validateSessionsResetParams",
  "sessions.delete": "validateSessionsDeleteParams",
  "sessions.compact": "validateSessionsCompactParams",
  "sessions.usage": "validateSessionsUsageParams",
  "sessions.usage.timeseries": "validateSessionsUsageTimeseriesParams",
  "sessions.usage.logs": "validateSessionsUsageLogsParams",
  "sessions.compaction.list": "validateSessionsCompactionListParams",
  "sessions.compaction.get": "validateSessionsCompactionGetParams",
  "sessions.compaction.branch": "validateSessionsCompactionBranchParams",
  "sessions.compaction.restore": "validateSessionsCompactionRestoreParams",
  "agents.list": "validateAgentsListParams",
  "agents.create": "validateAgentsCreateParams",
  "agents.update": "validateAgentsUpdateParams",
  "agents.delete": "validateAgentsDeleteParams",
  "agents.files.list": "validateAgentsFilesListParams",
  "agents.files.get": "validateAgentsFilesGetParams",
  "agents.files.set": "validateAgentsFilesSetParams",
  "skills.status": "validateSkillsStatusParams",
  "skills.search": "validateSkillsSearchParams",
  "skills.detail": "validateSkillsDetailParams",
  "skills.bins": "validateSkillsBinsParams",
  "skills.install": "validateSkillsInstallParams",
  "skills.update": "validateSkillsUpdateParams",
};

describe("OpenClaw gateway contract parity corpus", () => {
  it("covers the full finite mirrored control surface with explicit alias mapping", () => {
    const methods = corpus.cases.map((item) => item.method).toSorted();
    expect(methods).toEqual([
      "agents.create",
      "agents.delete",
      "agents.files.get",
      "agents.files.list",
      "agents.files.set",
      "agents.list",
      "agents.update",
      "sessions.abort",
      "sessions.compact",
      "sessions.compaction.branch",
      "sessions.compaction.get",
      "sessions.compaction.list",
      "sessions.compaction.restore",
      "sessions.create",
      "sessions.delete",
      "sessions.get",
      "sessions.list",
      "sessions.patch",
      "sessions.preview",
      "sessions.reset",
      "sessions.resolve",
      "sessions.send",
      "sessions.steer",
      "sessions.usage",
      "sessions.usage.logs",
      "sessions.usage.timeseries",
      "skills.bins",
      "skills.detail",
      "skills.install",
      "skills.search",
      "skills.status",
      "skills.update",
    ]);
    const steer = corpus.cases.find((item) => item.method === "sessions.steer");
    expect(steer?.validatorMethod).toBe("sessions.send");
  });

  it("keeps upstream OpenClaw validators aligned with the shared parity corpus", () => {
    for (const testCase of corpus.cases) {
      const exportName = VALIDATOR_EXPORTS[testCase.validatorMethod];
      expect(exportName, `missing validator mapping for ${testCase.method}`).toBeTruthy();
      const validator = protocol[exportName];
      expect(typeof validator, `missing upstream validator for ${testCase.method}`).toBe(
        "function",
      );
      const validate = validator as (value: unknown) => boolean;

      for (const payload of testCase.valid) {
        expect(
          validate(payload),
          `upstream validator rejected valid payload for ${testCase.method}`,
        ).toBe(true);
      }
      for (const payload of testCase.invalid) {
        expect(
          validate(payload),
          `upstream validator accepted invalid payload for ${testCase.method}`,
        ).toBe(false);
      }
    }
  });
});
