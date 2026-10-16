<script setup lang="ts">
import { onMounted } from 'vue'
import { openGalleryDb } from '@/infra/db'
import { EditorView, useEditorStore } from '@/features/editor'
import { CropOverlay, CropRotateAction, CropRotateTool } from '@/features/crop-rotate'
import { AdjustAction, AdjustBeforeLabel, AdjustTool } from '@/features/adjust'
import { DrawAction, DrawOverlay, DrawTool } from '@/features/draw'
import { ExportAction } from '@/features/export'
import {
  DeleteWorkDialog,
  GalleryAction,
  GalleryOverlay,
  GalleryStart,
  useGallery,
} from '@/features/gallery'
import { InstallAction, ReloadDialog, usePwaInstallUpdate } from '@/features/pwa-install-update'
import { UndoRedoActions } from '@/features/undo-redo'

// Start-up order: EditorView's setup installs the window drop guard first; the capability gate
// runs once it is mounted, and decides between SCR-01 and SCR-04 (AC-18).
const editor = useEditorStore()
const gallery = useGallery()
const pwa = usePwaInstallUpdate()
// Taken before anything can fail or the Editor can reload again, so the marker never outlives this
// start (pwa-install-update AC-08, ADR-0003, spec §6.1).
const markedWork = pwa.takeMarkedWork()

// The Gallery database opens next to the gate; a refusal only makes the Gallery unavailable for
// this page load. Nothing is loaded or reopened here (AC-05, AC-12), except the Work an update
// reload marked in this tab, once the Gallery is listed and the display is up (pwa-install-update
// AC-08). It reopens through the Gallery, with its spinner and its damaged-Work notice.
async function connectGallery(gate: Promise<void>) {
  const opened = await openGalleryDb()
  editor.connectGallery(opened)
  gallery.connect(opened)
  await gallery.refresh()
  await gate
  await pwa.resumeAfterUpdate(markedWork, {
    // A listing of its own: the start screen lists the Gallery too as it mounts, and only the newest
    // listing fills the entries, so the one awaited above may have left them empty.
    isListed: async (id) => {
      await gallery.refresh()
      return gallery.entries.some((entry) => entry.id === id)
    },
    reopen: (id, wording) => gallery.choose(id, wording),
  })
}

onMounted(() => {
  void connectGallery(editor.runCapabilityGate())
})
</script>

<template>
  <EditorView>
    <template #top-bar-leading-actions><GalleryAction /></template>
    <template #start-screen><GalleryStart /></template>
    <template #overlay><GalleryOverlay /></template>
    <template #top-bar-actions
      ><UndoRedoActions /><CropRotateAction /><AdjustAction /><DrawAction /><ExportAction /><InstallAction
    /></template>
    <!-- Each tool's halves mount only for its own tool in the slot. -->
    <template #tool-canvas>
      <CropOverlay v-if="editor.activeTool === 'crop-rotate'" />
      <AdjustBeforeLabel v-else-if="editor.activeTool === 'adjust'" />
      <DrawOverlay v-else-if="editor.activeTool === 'draw'" />
    </template>
    <template #tool-panel>
      <CropRotateTool v-if="editor.activeTool === 'crop-rotate'" />
      <AdjustTool v-else-if="editor.activeTool === 'adjust'" />
      <DrawTool v-else-if="editor.activeTool === 'draw'" />
    </template>
  </EditorView>
  <!-- The one delete confirmation: also reachable from the damaged notice, overlay closed. -->
  <DeleteWorkDialog standby />
  <!-- The Reload confirmation of the update notice (pwa-install-update SCR-06). -->
  <ReloadDialog />
</template>
