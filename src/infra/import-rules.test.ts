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
})
