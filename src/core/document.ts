/**
 * The Work document model. The scaffold only declares the identity of a Work; features add the
 * original reference, render params, crop/rotation and the drawing-layer reference.
 */
export interface Work {
  id: string
  name: string
  createdAt: number
  updatedAt: number
}
