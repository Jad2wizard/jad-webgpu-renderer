import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import fs from 'fs'

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

		console.log("Calling 'render_scatter_map' tool...")
		const mapResult = await client.callTool({
			name: 'render_scatter_map',
			arguments: {
				count: 500000,
				color: [0.8, 0.2, 0.2, 0.1],
				radius: 4,
				width: 800,
				height: 600,
			},
		})

		if (mapResult.content && mapResult.content[0] && mapResult.content[0].type === 'image') {
			console.log('Map Result: Received image content')
			const base64Data = mapResult.content[0].data
			const buffer = Buffer.from(base64Data, 'base64')
			fs.writeFileSync('test-scatter.png', buffer)
			console.log('Saved test-scatter.png')
		} else {
			console.log('Map Result:', JSON.stringify(mapResult, null, 2))
		}
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
