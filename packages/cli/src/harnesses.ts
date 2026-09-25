// The agent clients `sparky init` can set up. The registry lives in the engine so the app's Settings writes the same entry.
export {
  applyWrite as apply,
  configDiff as diff,
  detectHarnesses,
  harnessById,
  HARNESSES,
  HarnessError,
  installHarness,
  mcpEntry,
  SERVER_NAME,
  upsertJson,
  upsertToml,
  type Harness,
  type HarnessEnv,
  type HarnessStatus,
  type McpEntry,
  type WriteResult,
} from '@sparky/engine'
