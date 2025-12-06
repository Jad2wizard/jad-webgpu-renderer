import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'

async function main() {
	console.log('Starting MCP client...')

	const transport = new SSEClientTransport(new URL('http://localhost:3000/sse'))

	const client = new Client(
		{
			name: 'test-client',
			version: '1.0.0',
		},
		{
			capabilities: {},
		}
	)

	try {
		console.log('Connecting to server...')
		await client.connect(transport)
		console.log('Connected!')

		console.log('Listing tools...')
		const tools = await client.listTools()
		console.log('Tools:', JSON.stringify(tools, null, 2))

		console.log("Calling 'add' tool with a=10, b=20...")
		const result = await client.callTool({
			name: 'add',
			arguments: {
				a: 10,
				b: 20,
			},
		})
		console.log('Result:', JSON.stringify(result))
	} catch (error) {
		console.error('Error:', error)
	} finally {
		// Close client and exit
		try {
			// Using process.exit to force stop as requested
			console.log('Stopping client...')
			process.exit(0)
		} catch (e) {
			console.error('Error closing:', e)
			process.exit(1)
		}
	}
}

main()
