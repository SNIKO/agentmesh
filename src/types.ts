// ============================================
// SHARED TYPES
// ============================================

export interface Message<T = unknown> {
  role: string
  content: string
  data?: T
}
