// Detecting agent clients and adding Sparky's MCP entry to them, for the Settings Agents group.
import { AGENT_COMMAND_MISSING, agentAddedMessage, agentAddFailedError, agentAlreadyAddedMessage, agentUpdatedMessage, type AgentClient, type AgentInstallResult } from '@sparky/core'
import { detectHarnesses, harnessById, HarnessError, installedEntry, installHarness, type McpEntry } from '@sparky/engine'
import { app, type IpcMain } from 'electron'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/** How a client should start this copy of Sparky, or null when it is not an installed one (the dev tree). */
function entryForThisPc(): McpEntry | null {
  return installedEntry({
    platform: process.platform,
    pathDirs: (process.env.PATH ?? '').split(path.delimiter),
    resourcesDir: app.isPackaged ? process.resourcesPath : path.join(__dirname, '../../resources'),
    exists: (p) => fs.existsSync(p),
  })
}

function detect(): AgentClient[] {
  try {
    return detectHarnesses(os.homedir(), process.env, entryForThisPc())
  } catch (e) {
    console.error('Agent detection failed', e)
    return []
  }
}

function install(id: string): AgentInstallResult {
  const label = harnessById(id)?.label ?? id
  try {
    const entry = entryForThisPc()
    if (!entry) return { ok: false, message: AGENT_COMMAND_MISSING }
    const home = os.homedir()
    const listed = harnessById(id)?.listed(home, process.env) ?? false
    const r = installHarness(id, { home, ...entry })
    const message = !r.changed ? agentAlreadyAddedMessage(r.label) : listed ? agentUpdatedMessage(r.label) : agentAddedMessage(r.label)
    return { ok: true, message, path: r.file }
  } catch (e) {
    if (e instanceof HarnessError) return { ok: false, message: e.message }
    console.error('Adding Sparky to an agent client failed', e)
    return { ok: false, message: agentAddFailedError(label) }
  }
}

export function registerAgentsIpc(ipc: IpcMain): void {
  ipc.handle('agents:detect', () => detect())
  ipc.handle('agents:install', (_e, id: unknown) => install(String(id)))
}
