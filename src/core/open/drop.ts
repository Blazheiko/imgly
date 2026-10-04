export type DropItem<TFile> = { kind: 'file'; file: TFile } | { kind: 'other' }

/** Keeps the dropped files in browser order and counts everything else (AC-03, AC-04). */
export function orderDropCandidates<TFile>(items: DropItem<TFile>[]): {
  files: TFile[]
  nonFileCount: number
} {
  const files = items.flatMap((item) => (item.kind === 'file' ? [item.file] : []))
  return { files, nonFileCount: items.length - files.length }
}
