<script setup lang="ts">
import { onMounted } from 'vue'
import { EditorView, useEditorStore } from '@/features/editor'
import { CropOverlay, CropRotateAction, CropRotateTool } from '@/features/crop-rotate'
import { ExportAction } from '@/features/export'

// Start-up order: EditorView's setup installs the window drop guard first; the capability gate
// runs once it is mounted, and decides between SCR-01 and SCR-04 (AC-18).
const editor = useEditorStore()
onMounted(() => void editor.runCapabilityGate())
</script>

<template>
  <EditorView>
    <template #top-bar-actions><CropRotateAction /><ExportAction /></template>
    <template #tool-canvas><CropOverlay /></template>
    <template #tool-panel><CropRotateTool /></template>
  </EditorView>
</template>
