import { createModelGateway, type ModelGateway } from './gateway'

let instance: ModelGateway | null = null

export function getDefaultGateway(): ModelGateway {
  if (!instance) instance = createModelGateway()
  return instance
}
