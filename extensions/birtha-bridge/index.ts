import { definePluginEntry, type AnyAgentTool } from "openclaw/plugin-sdk/plugin-entry";
import { registerBirthaBridgeCli } from "./src/birtha-cli.js";
import { createBirthaBridgeHttpHandler } from "./src/birtha-http.js";
import { createBirthaQueryTool } from "./src/birtha-query-tool.js";
import { createBirthaQueryStreamTool } from "./src/birtha-stream-tool.js";
import { resolveMirrorDir } from "./src/session-mirror-store.js";

export default definePluginEntry({
  id: "birtha-bridge",
  name: "Birtha bridge",
  description:
    "POST Birtha /api/ai/query with openclaw-bridge v1 envelope, session mirror, SSE stream tool, and operator HTTP/CLI.",
  register(api) {
    api.registerTool(createBirthaQueryTool(api) as AnyAgentTool);
    api.registerTool(createBirthaQueryStreamTool(api) as AnyAgentTool);
    const mirrorDir = resolveMirrorDir(api.rootDir);
    api.registerHttpRoute({
      path: "/plugins/birtha-bridge",
      auth: "gateway",
      match: "prefix",
      handler: createBirthaBridgeHttpHandler({ mirrorDir, logger: api.logger }),
    });
    api.registerCli(
      ({ program }) => {
        registerBirthaBridgeCli(program, api.rootDir);
      },
      {
        commands: ["birtha"],
        descriptors: [
          {
            name: "birtha",
            description: "Birtha bridge operator commands (shell-local session mirror)",
            hasSubcommands: true,
          },
        ],
      },
    );
  },
});
