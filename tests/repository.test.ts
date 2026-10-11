import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LocalFileRepository, WorkspaceDatabase } from '../src/persistence/localRepository'

describe('local file persistence', () => {
  let database: WorkspaceDatabase
  let repository: LocalFileRepository
  beforeEach(() => {
    database = new WorkspaceDatabase(`workspace-test-${crypto.randomUUID()}`)
    repository = new LocalFileRepository(database)
  })
  afterEach(async () => { vi.restoreAllMocks(); await database.delete() })

  it('restores board and document records after reopening storage', async () => {
    const board = await repository.create('board', '  Visual direction  ')
    const document = await repository.create('document', 'Project story')
    database.close()
    await database.open()
    expect(await repository.load(board.id)).toEqual(board)
    expect(await repository.load(document.id)).toEqual(document)
    expect(board.title).toBe('Visual direction')
    expect(board.content).toEqual({ nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } })
    expect((await repository.list()).map(file => file.id).sort()).toEqual([board.id, document.id].sort())
    expect((await repository.list())[0]).not.toHaveProperty('content')
  })

  it('renames without changing identity or content, and deletes only the selected file', async () => {
    const board = await repository.create('board', 'First board')
    const document = await repository.create('document', 'Notes')
    await repository.rename(board.id, 'New direction')
    expect(await repository.load(board.id)).toMatchObject({ id: board.id, title: 'New direction', content: board.content })
    await repository.delete(board.id)
    expect(await repository.load(board.id)).toBeUndefined()
    expect(await repository.load(document.id)).toEqual(document)
  })

  it('rejects invalid names and missing rename targets without changing storage', async () => {
    await expect(repository.create('board', '  ')).rejects.toThrow('Give your file a name')
    await expect(repository.create('document', 'a'.repeat(121))).rejects.toThrow('120')
    await expect(repository.rename('missing-id', 'Name')).rejects.toThrow('no longer exists')
    expect(await repository.list()).toEqual([])
  })

  it('propagates storage failures without pretending a file was saved', async () => {
    vi.spyOn(database.files, 'add').mockRejectedValueOnce(new DOMException('Disk full', 'QuotaExceededError'))
    await expect(repository.create('board', 'Unsaved')).rejects.toThrow('Disk full')
    expect(await repository.list()).toEqual([])
  })
})
