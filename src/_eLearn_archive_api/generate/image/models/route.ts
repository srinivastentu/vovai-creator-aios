import { getDefaultGateway } from '@/lib/core/models/default-gateway'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(): Promise<Response> {
  const gateway = getDefaultGateway()
  const models = gateway.getAvailableModels('image-generation').map((m) => ({
    id: m.id,
    name: m.name,
    providerId: m.providerId,
    qualityTier: m.qualityTier,
    status: m.status,
    resolutions: m.supportedParams.resolutions ?? [],
  }))

  return new Response(
    JSON.stringify({ success: true, data: { models }, error: null }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
}
