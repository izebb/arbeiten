import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { addTask, resolveView, updateTask, withRepos } from './core'

const server = new McpServer({ name: 'arbeiten', version: '1.0.0' })

const json = (data: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }]
})

server.registerTool(
  'add_task',
  {
    title: 'Add task',
    description:
      'Create a task in Arbeiten. Project and labels are matched by name (created if missing). Due accepts today/tomorrow/<weekday>/YYYY-MM-DD.',
    inputSchema: {
      content: z.string().describe('The task title'),
      project: z.string().optional().describe('Project name (defaults to Inbox)'),
      due: z.string().optional().describe('today | tomorrow | mon..sun | YYYY-MM-DD'),
      priority: z.number().int().min(1).max(4).optional().describe('1 = highest, 4 = none'),
      labels: z.array(z.string()).optional().describe('Label names'),
      duration: z.number().int().positive().optional().describe('Estimated minutes'),
      recurrence: z
        .enum(['daily', 'weekdays', 'weekly', 'monthly'])
        .optional()
        .describe('Repeat rule')
    }
  },
  async (args) => json(withRepos((r) => addTask(r, args)))
)

server.registerTool(
  'add_label',
  {
    title: 'Add label',
    description: 'Create a label.',
    inputSchema: {
      name: z.string(),
      color: z.string().optional().describe('Hex color like #14aaf5')
    }
  },
  async ({ name, color }) => json(withRepos((r) => r.labels.create({ name, color })))
)

server.registerTool(
  'complete_task',
  {
    title: 'Complete task',
    description: 'Mark a task complete (recurring tasks reschedule to the next occurrence).',
    inputSchema: { id: z.number().int() }
  },
  async ({ id }) => json(withRepos((r) => r.tasks.setComplete(id, true)))
)

server.registerTool(
  'reopen_task',
  {
    title: 'Reopen task',
    description: 'Mark a completed task as not complete.',
    inputSchema: { id: z.number().int() }
  },
  async ({ id }) => json(withRepos((r) => r.tasks.setComplete(id, false)))
)

server.registerTool(
  'update_task',
  {
    title: 'Update task',
    description: 'Update fields of a task. Only provided fields change.',
    inputSchema: {
      id: z.number().int(),
      content: z.string().optional(),
      description: z.string().optional(),
      project: z.string().optional(),
      due: z.string().optional().describe('today/tomorrow/<weekday>/YYYY-MM-DD, or empty to clear'),
      priority: z.number().int().min(1).max(4).optional(),
      labels: z.array(z.string()).optional(),
      duration: z.number().int().optional(),
      recurrence: z.enum(['daily', 'weekdays', 'weekly', 'monthly']).optional()
    }
  },
  async ({ id, ...patch }) => json(withRepos((r) => updateTask(r, id, patch)))
)

server.registerTool(
  'delete_task',
  {
    title: 'Delete task',
    description: 'Delete a task permanently.',
    inputSchema: { id: z.number().int() }
  },
  async ({ id }) => {
    withRepos((r) => r.tasks.delete(id))
    return json({ deleted: id })
  }
)

server.registerTool(
  'list_tasks',
  {
    title: 'List tasks',
    description:
      'List tasks for a view: today | inbox | upcoming | project:<name> | label:<name> | priority:<1-4> | search:<text>.',
    inputSchema: { view: z.string().default('today') }
  },
  async ({ view }) => json(withRepos((r) => r.tasks.list(resolveView(r, view))))
)

server.registerTool(
  'list_projects',
  { title: 'List projects', description: 'List all projects.', inputSchema: {} },
  async () => json(withRepos((r) => r.projects.list()))
)

server.registerTool(
  'list_labels',
  { title: 'List labels', description: 'List all labels.', inputSchema: {} },
  async () => json(withRepos((r) => r.labels.list()))
)

async function main(): Promise<void> {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((err) => {
  process.stderr.write(`arbeiten MCP server failed: ${String(err)}\n`)
  process.exit(1)
})
