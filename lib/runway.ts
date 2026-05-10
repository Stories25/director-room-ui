import RunwayML from '@runwayml/sdk'

// Server-only singleton — never import this on the client
const getRunwayClient = () => {
  if (!process.env.RUNWAYML_API_SECRET) {
    throw new Error('RUNWAYML_API_SECRET is not set')
  }
  return new RunwayML({ apiKey: process.env.RUNWAYML_API_SECRET })
}

export default getRunwayClient
