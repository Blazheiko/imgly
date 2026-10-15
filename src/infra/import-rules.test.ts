// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { ESLint } from 'eslint'

/** sad.md §1 Decision override 1: infra may use core's types and pure functions, never Vue/Pinia/features. */
async function lint(code: string, filePath = 'src/infra/platform/probe.ts') {
  const [result] = await new ESLint().lintText(code, { filePath })
  return result!.messages.filter((m) => m.ruleId === 'no-restricted-imports').map((m) => m.message)
}

describe('infra import rules (ESLint)', () => {
  it.each([
    "import { ref } from 'vue'\nexport const x = ref(1)\n",
    "import { defineStore } from 'pinia'\nexport const s = defineStore\n",
    "import { useEditorStore } from '@/features/editor'\nexport const u = useEditorStore\n",
  ])('rejects %#', async (code) => {
    expect(await lint(code)).not.toEqual([])
  })

  it('allows core types and pure functions', async () => {
    expect(
      await lint(
        "import { sniffImageHeader, type AppError } from '@/core'\nexport const f: (e: AppError) => unknown = sniffImageHeader as never\n",
      ),
    ).toEqual([])
  })

  it('applies to work-codec: no Vue, Pinia, features or app shell; core and shared allowed', async () => {
    const probe = 'src/infra/work-codec/probe.ts'
    for (const code of [
      "import { ref } from 'vue'\nexport const x = ref(1)\n",
      "import { useEditorStore } from '@/features/editor'\nexport const u = useEditorStore\n",
      "import { x } from '@/app'\nexport const y = x\n",
    ]) {
      expect(await lint(code, probe)).not.toEqual([])
    }
    expect(
      await lint(
        "import { type AppError } from '@/core'\nimport { newId } from '@/shared'\nexport const f: (e: AppError) => unknown = newId as never\n",
        probe,
      ),
    ).toEqual([])
  })
})
