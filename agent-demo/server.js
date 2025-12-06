import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import dotenv from 'dotenv'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const EventSource = require('eventsource')

// Polyfill for eventsource in Node environment
global.EventSource = EventSource

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

// MCP Client Setup
let mcpClient
const MCP_SERVER_URL = 'http://localhost:3000/sse'

async function connectToMcpServer() {
	try {
		const transport = new SSEClientTransport(new URL(MCP_SERVER_URL))
		mcpClient = new Client(
			{ name: 'agent-demo-client', version: '1.0.0' },
			{ capabilities: {} }
		)
		await mcpClient.connect(transport)
		console.log('Connected to MCP Server')
		return true
	} catch (error) {
		console.error('Failed to connect to MCP Server:', error.message)
		return false
	}
}

// LangChain Agent Setup
// Initialize with empty tools first, will populate if connection succeeds
let chatModel

// Route to handle chat
app.post('/chat', async (req, res) => {
	const { message } = req.body

	// Removed env check as we are using hardcoded key for this demo
	// if (!process.env.OPENAI_API_KEY) { ... }

	if (!mcpClient) {
		const connected = await connectToMcpServer()
		if (!connected) {
			return res.status(503).json({ error: 'MCP Server not available' })
		}
	}

	try {
		// 1. Get tools from MCP Server
		const mcpToolsList = await mcpClient.listTools()

		// 2. Convert MCP tools to LangChain tools
		const tools = mcpToolsList.tools.map((mcpTool) => {
			// Dynamically create tool from MCP definition
			// We interpret the JSON Schema from mcpTool.inputSchema.

			const inputSchema = mcpTool.inputSchema
			let zodSchema = z.any()

			// Simple runtime conversion of basic JSON Schema types to Zod
			if (inputSchema && inputSchema.type === 'object' && inputSchema.properties) {
				const shape = {}
				for (const [key, prop] of Object.entries(inputSchema.properties)) {
					let fieldSchema
					if (prop.type === 'string') fieldSchema = z.string()
					else if (prop.type === 'number' || prop.type === 'integer')
						fieldSchema = z.number()
					else if (prop.type === 'boolean') fieldSchema = z.boolean()
					else if (prop.type === 'array') {
						if (prop.items && prop.items.type === 'number')
							fieldSchema = z.array(z.number())
						else if (prop.items && prop.items.type === 'string')
							fieldSchema = z.array(z.string())
						else fieldSchema = z.array(z.any())
					} else fieldSchema = z.any()

					if (prop.description) fieldSchema = fieldSchema.describe(prop.description)
					if (inputSchema.required && !inputSchema.required.includes(key))
						fieldSchema = fieldSchema.optional()

					shape[key] = fieldSchema
				}
				zodSchema = z.object(shape)
			}

			return tool(
				async (input) => {
					console.log('Calling MCP tool:', mcpTool.name, input)
					const result = await mcpClient.callTool({
						name: mcpTool.name,
						arguments: input,
					})

					// Extract image data if present (Specific logic for our render tool)
					if (result.content && result.content.some((c) => c.type === 'image')) {
						const imageContent = result.content.find((c) => c.type === 'image')
						return `IMAGE_RESULT:${imageContent.data}`
					}
					return JSON.stringify(result)
				},
				{
					name: mcpTool.name,
					description: mcpTool.description,
					schema: zodSchema,
				}
			)
		})

		// 3. Bind tools to LLM
		chatModel = new ChatOpenAI({
			modelName: 'qwen-max',
			temperature: 0,
			apiKey: 'sk-106ef50f2e624fc297d4d55cc25e4ab2', // Changed from openAIApiKey to apiKey
			configuration: {
				baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
			},
		}).bindTools(tools)

		// 4. Run Agent Logic
		const messages = [
			new SystemMessage(
				'You are a helpful assistant that can render scatter maps. If the user asks for a map, use the render_scatter_map tool. When you get an image result (starting with IMAGE_RESULT:), just pass it back clearly.'
			),
			new HumanMessage(message),
		]

		const result = await chatModel.invoke(messages)

		// Check if there are tool calls
		if (result.tool_calls && result.tool_calls.length > 0) {
			// Execute tool calls
			for (const toolCall of result.tool_calls) {
				const selectedTool = tools.find((t) => t.name === toolCall.name)
				if (selectedTool) {
					console.log(`Executing tool ${toolCall.name}...`)
					const toolOutput = await selectedTool.invoke(toolCall.args)

					// If output contains our image marker, return it directly or include it
					if (typeof toolOutput === 'string' && toolOutput.startsWith('IMAGE_RESULT:')) {
						const base64Data = toolOutput.replace('IMAGE_RESULT:', '')
						return res.json({
							reply: 'Here is the scatter map you requested.',
							image: base64Data,
						})
					}

					// For other tools (like add), we might want to feed it back to LLM,
					// but for this "simplest" demo, returning the result is okay or doing one more loop.
					// Let's do one more loop to get final text.
					messages.push(result) // Add AI message with tool calls
					messages.push({
						role: 'tool',
						tool_call_id: toolCall.id,
						content: toolOutput,
					})
				}
			}
			// Final response after tool execution
			const finalResponse = await chatModel.invoke(messages)
			return res.json({ reply: finalResponse.content })
		}

		res.json({ reply: result.content })
	} catch (error) {
		console.error('Error processing chat:', error)
		res.status(500).json({ error: error.message })
	}
})

const PORT = 4000
app.listen(PORT, () => {
	console.log(`Agent Demo Server running on http://localhost:${PORT}`)
})
