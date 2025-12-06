import express from 'express'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import { z } from 'zod'

const app = express()
app.use(express.json())

// Create an MCP server instance factory
// We create a new server instance for each connection because McpServer maintains connection state
const createServer = () => {
	const server = new McpServer({
		name: 'mcp-server',
		version: '0.0.1',
	})

	server.tool(
		'add',
		'Add two numbers',
		{
			a: z.number().describe('First number'),
			b: z.number().describe('Second number'),
		},
		async ({ a, b }) => {
			return {
				content: [
					{
						type: 'text',
						text: String(a + b),
					},
				],
			}
		}
	)

	return server
}

// Store transports by session ID
const transports = {}

app.get('/sse', async (req, res) => {
	console.log('New SSE connection request')

	// Create a new transport
	// The client will send messages to /messages?sessionId=...
	const transport = new SSEServerTransport('/messages', res)

	const sessionId = transport.sessionId
	transports[sessionId] = transport

	transport.onclose = () => {
		console.log(`Transport closed for session ${sessionId}`)
		delete transports[sessionId]
	}

	const server = createServer()
	await server.connect(transport)
	console.log(`Connected session ${sessionId}`)
})

app.post('/messages', async (req, res) => {
	const sessionId = req.query.sessionId
	if (!sessionId) {
		res.status(400).send('Missing sessionId')
		return
	}

	const transport = transports[sessionId]
	if (!transport) {
		res.status(404).send('Session not found')
		return
	}

	console.log(req.body)
	await transport.handlePostMessage(req, res, req.body)
})

const port = Number(process.env.PORT || 3000)
app.listen(port, () => {
	console.log(`MCP server running on http://localhost:${port}`)
	console.log(`SSE endpoint: http://localhost:${port}/sse`)
})
