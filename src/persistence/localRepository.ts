import Dexie, { type Table } from 'dexie'
import { normalizeTitle, type FileKind, type FileRepository, type WorkspaceFile } from '../files/types'

export class WorkspaceDatabase extends Dexie {
  files!: Table<WorkspaceFile, string>

  constructor(name = 'portfolio-workspace') {
    super(name)
    this.version(1).stores({ files: 'id, createdAt, updatedAt, kind' })
  }
}

export class LocalFileRepository implements FileRepository {
  constructor(private database: WorkspaceDatabase) {}

  async list() {
    const files = await this.database.files.orderBy('createdAt').toArray()
    return files.map(({ content: _content, ...summary }) => summary)
  }

  load(id: string) { return this.database.files.get(id) }

  async create(kind: FileKind, title: string): Promise<WorkspaceFile> {
    const common = {
      id: crypto.randomUUID(), title: normalizeTitle(title), schemaVersion: 1 as const,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }
    const file: WorkspaceFile = kind === 'board'
      ? { ...common, kind, content: { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } } }
      : { ...common, kind, content: { type: 'doc', content: [{ type: 'paragraph' }] } }
    await this.database.files.add(file)
    return file
  }

  async rename(id: string, title: string) {
    const count = await this.database.files.update(id, {
      title: normalizeTitle(title), updatedAt: new Date().toISOString(),
    })
    if (!count) throw new Error('This file no longer exists.')
  }

  async delete(id: string) { await this.database.files.delete(id) }
}

export const localRepository = new LocalFileRepository(new WorkspaceDatabase())
