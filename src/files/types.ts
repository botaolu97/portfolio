export type FileKind = 'board' | 'document'
export type BoardContent = { nodes: unknown[]; edges: unknown[]; viewport: { x: number; y: number; zoom: number } }
export type DocumentContent = { type: 'doc'; content: { type: 'paragraph' }[] }
export type WorkspaceFile = {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  schemaVersion: 1
} & ({ kind: 'board'; content: BoardContent } | { kind: 'document'; content: DocumentContent })
export type FileSummary = Omit<WorkspaceFile, 'content'>

export interface FileRepository {
  list(): Promise<FileSummary[]>
  load(id: string): Promise<WorkspaceFile | undefined>
  create(kind: FileKind, title: string): Promise<WorkspaceFile>
  rename(id: string, title: string): Promise<void>
  delete(id: string): Promise<void>
}

export function normalizeTitle(title: string): string {
  const result = title.trim()
  if (!result) throw new Error('Give your file a name.')
  if (result.length > 120) throw new Error('Use a name with 120 characters or fewer.')
  return result
}
