/**
 * Birtha bridge: HTTPS clients for Xlotyl api-service and OpenClaw tool registration.
 */
import { definePluginEntry, type AnyAgentTool } from "openclaw/plugin-sdk/plugin-entry";
import { createBirthaToolModelTool } from "./src/birtha-tool-model-tool.js";
export {
  birthaToolQuery,
  type BirthaToolQueryArgs,
  type ToolQueryResult,
} from "./src/birtha-tool-query.js";

export default definePluginEntry({
  id: "birtha-bridge",
  name: "Birtha Bridge",
  description: "HTTPS clients for Birtha / Xlotyl api-service (tool-model lane)",
  register(api) {
    api.registerTool(createBirthaToolModelTool(api) as AnyAgentTool);
  },
});
