import { ofetch } from 'ofetch'
import type { ProjectListItem, ProjectDetail, DatasetData, ChatSessionItem } from '@shared/types'

const api = ofetch.create({
	baseURL: '/api',
	headers: { 'Content-Type': 'application/json' },
	onRequest({ options }) {
		const token = localStorage.getItem('token')
		if (token) {
			options.headers = {
				...(options.headers as any),
				Authorization: `Bearer ${token}`,
			} as any
		}
	},
})

// ---- 项目 ----

export function fetchProjects() {
	return api<{ projects: ProjectListItem[] }>('/projects')
}

export function createProject(data: { name?: string; description?: string }) {
	return api<{ project: { id: string; name: string } }>('/projects', {
		method: 'POST',
		body: data,
	})
}

export function fetchProject(id: string) {
	return api<{ project: ProjectDetail }>(`/projects/${id}`)
}

export function deleteProject(id: string) {
	return api<{ success: boolean }>(`/projects/${id}`, { method: 'DELETE' })
}

// ---- 图层 ----

export function createLayer(projectId: string, data: Record<string, unknown>) {
	return api<{ layer: Record<string, unknown> }>(`/projects/${projectId}/layers`, {
		method: 'POST',
		body: data,
	})
}

export function updateLayer(projectId: string, layerId: string, data: Record<string, unknown>) {
	return api<{ layer: Record<string, unknown> }>(`/projects/${projectId}/layers/${layerId}`, {
		method: 'PUT',
		body: data,
	})
}

export function deleteLayer(projectId: string, layerId: string) {
	return api<{ success: boolean }>(`/projects/${projectId}/layers/${layerId}`, {
		method: 'DELETE',
	})
}

// ---- 数据集 ----

export function uploadDataset(projectId: string, file: File, name?: string) {
	const form = new FormData()
	form.append('file', file)
	if (name) form.append('name', name)
	return api<{
		dataset: {
			id: string
			name: string
			featureCount: number
			geometryType: string
			extent: { w: number; s: number; e: number; n: number }
			propertyFields: string[]
		}
	}>(`/projects/${projectId}/datasets`, {
		method: 'POST',
		body: form,
		headers: {}, // 让浏览器自动设置 multipart Content-Type
	})
}

export function fetchDatasetData(projectId: string, datasetId: string) {
	return api<DatasetData>(`/projects/${projectId}/datasets/${datasetId}/data`)
}

// ---- 对话 ----

export function fetchChatSessions(projectId: string) {
	return api<{ sessions: ChatSessionItem[] }>(`/chat/sessions?projectId=${projectId}`)
}

export function fetchChatMessages(sessionId: string) {
	return api<{
		messages: {
			id: string
			role: string
			content: string
			toolCalls: string
			createdAt: string
		}[]
	}>(`/chat/sessions/${sessionId}`)
}

export function deleteChatSession(sessionId: string) {
	return api<{ success: boolean }>(`/chat/sessions/${sessionId}`, { method: 'DELETE' })
}
