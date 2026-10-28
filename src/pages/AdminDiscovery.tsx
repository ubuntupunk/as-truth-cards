/**
 * Admin discovery review UI for research source candidates.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'preact/hooks'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { useAdminCheck } from '@/hooks/useAdminCheck'

type Candidate = {
  id: string
  provider: string
  providerRecordId: string
  title: string
  authors: string | null
  publicationDate: string | null
  sourceTypeHint: string | null
  doi: string | null
  url: string | null
  identifiers: unknown[]
  provenance: unknown
  query: string
  retrievedAt: string
  reviewStatus: string
  reviewedBy: string | null
  reviewedAt: string | null
  reviewNotes: string | null
  promotedSourceId: string | null
  revision: number
  createdAt: string
}

const AdminDiscovery = () => {
  const { isAdmin, loading, isSignedIn } = useAdminCheck()
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [providerFilter, setProviderFilter] = useState<string>('')
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({})
  const [promoteSourceIds, setPromoteSourceIds] = useState<
    Record<string, string>
  >({})
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery<{ items: Candidate[]; total: number }>({
    queryKey: ['discovery-candidates', statusFilter, providerFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      if (providerFilter) params.set('provider', providerFilter)
      const res = await fetch(
        `/api/discovery/candidates?${params.toString()}`,
        {
          credentials: 'include',
        },
      )
      if (!res.ok) throw new Error('Failed to fetch candidates')
      return res.json()
    },
    enabled: isAdmin && !loading,
  })

  const reviewMutation = useMutation({
    mutationFn: async ({
      id,
      decision,
      notes,
      revision,
    }: {
      id: string
      decision: string
      notes?: string
      revision: number
    }) => {
      const res = await fetch(`/api/discovery/candidates/${id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          decision,
          notes: notes || null,
          expectedRevision: revision,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to review')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discovery-candidates'] })
      toast({
        title: 'Reviewed',
        description: 'Candidate reviewed successfully',
      })
    },
    onError: (err: Error) => {
      toast({
        title: 'Error',
        description: err.message,
        variant: 'destructive',
      })
    },
  })

  const promoteMutation = useMutation({
    mutationFn: async ({
      id,
      sourceId,
      revision,
    }: {
      id: string
      sourceId: string
      revision: number
    }) => {
      const res = await fetch(`/api/discovery/candidates/${id}/promote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sourceId, expectedRevision: revision }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to promote')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discovery-candidates'] })
      toast({
        title: 'Promoted',
        description: 'Candidate promoted successfully',
      })
    },
    onError: (err: Error) => {
      toast({
        title: 'Error',
        description: err.message,
        variant: 'destructive',
      })
    },
  })

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-grow pt-24 pb-16 px-4 md:px-8">
          <div className="container mx-auto max-w-6xl text-center py-12">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (!isSignedIn || !isAdmin) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-grow pt-24 pb-16 px-4 md:px-8">
          <div className="container mx-auto max-w-4xl text-center py-12">
            <h1 className="text-2xl font-bold mb-4">
              {!isSignedIn ? 'Sign in required' : 'Access denied'}
            </h1>
            <p className="text-muted-foreground">
              {!isSignedIn
                ? 'Please sign in to access the admin panel'
                : "You don't have permission to access this page"}
            </p>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  const candidates = data?.items ?? []

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow pt-24 pb-16 px-4 md:px-8">
        <div className="container mx-auto max-w-6xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Discovery Review</h1>
            <p className="text-muted-foreground">
              Review research source candidates from Crossref and DataCite.
              Candidates are not automatically treated as evidence.
            </p>
          </div>

          <div className="mb-6 flex flex-wrap gap-4">
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter((e.target as HTMLSelectElement).value)
              }
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">All statuses</option>
              <option value="CANDIDATE">Candidate</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="DEFERRED">Deferred</option>
            </select>
            <select
              value={providerFilter}
              onChange={(e) =>
                setProviderFilter((e.target as HTMLSelectElement).value)
              }
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">All providers</option>
              <option value="crossref">Crossref</option>
              <option value="datacite">DataCite</option>
            </select>
          </div>

          {candidates.length === 0 ? (
            <Alert>
              <AlertTitle>No candidates</AlertTitle>
              <AlertDescription>
                No discovery candidates match the current filters.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              {candidates.map((candidate) => (
                <div
                  key={candidate.id}
                  className="rounded-lg border border-border bg-card p-6"
                >
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h2 className="text-lg font-semibold">
                        {candidate.title}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {candidate.authors || 'Unknown authors'} •{' '}
                        {candidate.publicationDate || 'Unknown date'} •{' '}
                        {candidate.provider}
                      </p>
                    </div>
                    <span className="rounded-full bg-muted px-2 py-1 text-xs">
                      {candidate.reviewStatus}
                    </span>
                  </div>
                  {candidate.doi && (
                    <p className="mb-2 text-sm">DOI: {candidate.doi}</p>
                  )}
                  {candidate.url && (
                    <a
                      href={candidate.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mb-2 inline-block text-sm text-primary hover:underline"
                    >
                      {candidate.url}
                    </a>
                  )}
                  <p className="mb-4 text-xs text-muted-foreground">
                    Query: {candidate.query} • Retrieved:{' '}
                    {candidate.retrievedAt}
                  </p>
                  {candidate.reviewNotes && (
                    <p className="mb-4 text-sm">
                      Notes: {candidate.reviewNotes}
                    </p>
                  )}
                  {candidate.promotedSourceId && (
                    <p className="mb-4 text-sm text-green-600">
                      Promoted to source: {candidate.promotedSourceId}
                    </p>
                  )}
                  {candidate.reviewStatus === 'CANDIDATE' && (
                    <div className="space-y-3">
                      <input
                        type="text"
                        placeholder="Review notes (optional)"
                        value={reviewNotes[candidate.id] || ''}
                        onChange={(e) =>
                          setReviewNotes({
                            ...reviewNotes,
                            [candidate.id]: (e.target as HTMLInputElement)
                              .value,
                          })
                        }
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          onClick={() =>
                            reviewMutation.mutate({
                              id: candidate.id,
                              decision: 'APPROVED',
                              notes: reviewNotes[candidate.id],
                              revision: candidate.revision,
                            })
                          }
                          disabled={reviewMutation.isPending}
                        >
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            reviewMutation.mutate({
                              id: candidate.id,
                              decision: 'DEFERRED',
                              notes: reviewNotes[candidate.id],
                              revision: candidate.revision,
                            })
                          }
                          disabled={reviewMutation.isPending}
                        >
                          Defer
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() =>
                            reviewMutation.mutate({
                              id: candidate.id,
                              decision: 'REJECTED',
                              notes: reviewNotes[candidate.id],
                              revision: candidate.revision,
                            })
                          }
                          disabled={reviewMutation.isPending}
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                  )}
                  {(candidate.reviewStatus === 'APPROVED' ||
                    candidate.reviewStatus === 'CANDIDATE') &&
                    !candidate.promotedSourceId && (
                      <div className="mt-4 space-y-2 rounded-md border border-border p-3">
                        <p className="text-sm font-medium">Promote to source</p>
                        <p className="text-xs text-muted-foreground">
                          Promotion links this candidate to an existing source
                          (no auto-creation). Provide a source UUID.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <input
                            type="text"
                            placeholder="Source UUID"
                            value={promoteSourceIds[candidate.id] || ''}
                            onChange={(e) =>
                              setPromoteSourceIds({
                                ...promoteSourceIds,
                                [candidate.id]: (e.target as HTMLInputElement)
                                  .value,
                              })
                            }
                            className="w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm"
                          />
                          <Button
                            size="sm"
                            onClick={() => {
                              const sourceId = promoteSourceIds[candidate.id]
                              if (!sourceId) {
                                toast({
                                  title: 'Error',
                                  description: 'Source UUID required',
                                  variant: 'destructive',
                                })
                                return
                              }
                              promoteMutation.mutate({
                                id: candidate.id,
                                sourceId,
                                revision: candidate.revision,
                              })
                            }}
                            disabled={promoteMutation.isPending}
                          >
                            Promote
                          </Button>
                        </div>
                      </div>
                    )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default AdminDiscovery
