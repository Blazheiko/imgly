<script setup lang="ts">
import { onMounted } from 'vue'
import { EditorView, useEditorStore } from '@/features/editor'
import { CropOverlay, CropRotateAction, CropRotateTool } from '@/features/crop-rotate'
import { AdjustAction, AdjustBeforeLabel, AdjustTool } from '@/features/adjust'
import { DrawAction } from '@/features/draw'
import { ExportAction } from '@/features/export'

// Start-up order: EditorView's setup installs the window drop guard first; the capability gate
// runs once it is mounted, and decides between SCR-01 and SCR-04 (AC-18).
const editor = useEditorStore()
onMounted(() => void editor.runCapabilityGate())
</script>

<template>
  <EditorView>
    <template #top-bar-actions
      ><CropRotateAction /><AdjustAction /><DrawAction /><ExportAction
    /></template>
    <!-- Each tool's halves mount only for its own tool in the slot. -->
    <template #tool-canvas>
      <CropOverlay v-if="editor.activeTool === 'crop-rotate'" />
      <AdjustBeforeLabel v-else-if="editor.activeTool === 'adjust'" />
    </template>
    <template #tool-panel>
      <CropRotateTool v-if="editor.activeTool === 'crop-rotate'" />
      <AdjustTool v-else-if="editor.activeTool === 'adjust'" />
    </template>
  </EditorView>
</template>
