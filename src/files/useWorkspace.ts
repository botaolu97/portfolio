import { useCallback, useEffect, useState } from 'react'
import type { FileKind, FileRepository, FileSummary } from './types'

export function useWorkspace(repository: FileRepository) {
  const [files, setFiles] = useState<FileSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)

  const refresh = useCallback(async () => {
    try { setFiles(await repository.list()); setError(null) }
    catch { setError('We couldn’t open local storage. Allow browser storage, then retry.') }
    finally { setLoading(false) }
  }, [repository])
  useEffect(() => { void refresh() }, [refresh])

  async function mutate<T>(operation: () => Promise<T>): Promise<T> {
    const result = await operation()
    setRevision(value => value + 1)
    await refresh()
    return result
  }

  return {
    files, loading, error, revision, refresh,
    create: (kind: FileKind, title: string) => mutate(() => repository.create(kind, title)),
    rename: (id: string, title: string) => mutate(() => repository.rename(id, title)),
    remove: (id: string) => mutate(() => repository.delete(id)),
  }
}
