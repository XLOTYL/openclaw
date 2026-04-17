/**
 * Birtha bridge extension entry — exports HTTP client for the tool-model lane.
 * Full tool registration alongside ``birtha_query`` may extend this module later.
 */
export {
  birthaToolQuery,
  type BirthaToolQueryArgs,
  type ToolQueryResult,
} from "./src/birtha-tool-query.js";
