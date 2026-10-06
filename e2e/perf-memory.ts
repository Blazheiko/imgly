/**
 * Shared @perf measurements: p95 and Chrome's renderer + GPU memory, graphics included (sad.md §10;
 * export spec §6 Memory row, whole-page memory after a forced garbage collection).
 */
import { execFileSync } from 'node:child_process'
import type { Page } from '@playwright/test'

export const p95 = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)]!
}

const UNIT_KIB = { KB: 1, MB: 1024, GB: 1024 * 1024 } as const

/**
 * Memory (KiB) of one process, graphics included. On macOS, RSS leaves out GPU textures (they live
 * in IOSurface/IOAccelerator memory), so it reads the physical footprint, which counts them.
 * Elsewhere it falls back to RSS.
 */
function processKiB(pid: number): number {
  if (process.platform === 'darwin') {
    const out = execFileSync('footprint', ['-p', String(pid)]).toString()
    const match = /Footprint: ([\d.]+) (KB|MB|GB)/.exec(out)
    if (!match) throw new Error(`no footprint for pid ${pid}`)
    return Number(match[1]) * UNIT_KIB[match[2] as keyof typeof UNIT_KIB]
  }
  return Number(
    execFileSync('ps', ['-o', 'rss=', '-p', String(pid)])
      .toString()
      .trim(),
  )
}

/** Memory (KiB) of Chrome's renderer and GPU processes, graphics included. */
async function rendererAndGpuKiB(page: Page): Promise<number> {
  const session = await page.context().browser()!.newBrowserCDPSession()
  const { processInfo } = (await session.send('SystemInfo.getProcessInfo')) as {
    processInfo: { type: string; id: number }[]
  }
  await session.detach()
  const pids = processInfo.filter((p) => p.type === 'renderer' || p.type === 'GPU').map((p) => p.id)
  return pids.reduce((sum, pid) => {
    try {
      return sum + processKiB(pid)
    } catch {
      return sum
    }
  }, 0)
}

async function collectGarbage(page: Page) {
  const session = await page.context().newCDPSession(page)
  await session.send('HeapProfiler.collectGarbage')
  await session.detach()
  await page.waitForTimeout(500)
}

/**
 * Renderer + GPU memory once it stops moving. Chrome's GPU process releases freed texture memory
 * lazily, a second or two after the last upload, so an immediate sample measures that release
 * timing rather than what the app retains. Waits past that release, then samples every second
 * until three in a row agree within 2%.
 */
export async function settledKiB(page: Page): Promise<number> {
  await collectGarbage(page)
  await page.waitForTimeout(3000)
  const samples = [await rendererAndGpuKiB(page)]
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(1000)
    samples.push(await rendererAndGpuKiB(page))
    const last = samples.slice(-3)
    if (last.length === 3 && Math.max(...last) - Math.min(...last) <= Math.min(...last) * 0.02) {
      return last.at(-1)!
    }
  }
  return samples.at(-1)!
}
