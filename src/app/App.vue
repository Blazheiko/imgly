<script setup lang="ts">
import { onMounted } from 'vue'
import { openGalleryDb } from '@/infra/db'
import { EditorView, useEditorStore } from '@/features/editor'
import { CropOverlay, CropRotateAction, CropRotateTool } from '@/features/crop-rotate'
import { AdjustAction, AdjustBeforeLabel, AdjustTool } from '@/features/adjust'
import { DrawAction, DrawOverlay, DrawTool } from '@/features/draw'
import { ExportAction } from '@/features/export'
import { GalleryAction, GalleryOverlay, GalleryStart, useGallery } from '@/features/gallery'
import { UndoRedoActions } from '@/features/undo-redo'

// Start-up order: EditorView's setup installs the window drop guard first; the capability gate
// runs once it is mounted, and decides between SCR-01 and SCR-04 (AC-18).
const editor = useEditorStore()
const gallery = useGallery()

// The Gallery database opens next to the gate; a refusal only makes the Gallery unavailable for
// this page load. Nothing is loaded or reopened here (AC-05, AC-12).
async function connectGallery() {
  const opened = await openGalleryDb()
  editor.connectGallery(opened)
  gallery.connect(opened)
  await gallery.refresh()
}

onMounted(() => {
  void editor.runCapabilityGate()
  void connectGallery()
})
</script>

<template>
  <EditorView>
    <template #top-bar-leading-actions><GalleryAction /></template>
    <template #start-screen><GalleryStart /></template>
    <template #overlay><GalleryOverlay /></template>
    <template #top-bar-actions
      ><UndoRedoActions /><CropRotateAction /><AdjustAction /><DrawAction /><ExportAction
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
</template>
