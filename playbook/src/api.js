const BASE = '/api/playbook'

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}

export const api = {
  me: () => req('GET', '/me'),

  // Playbooks
  listPlaybooks: (all = false) => req('GET', `/playbooks${all ? '?all=true' : ''}`),
  getPlaybook:   (id)          => req('GET', `/playbooks/${id}`),
  createPlaybook:(body)        => req('POST', '/playbooks', body),
  updatePlaybook:(id, body)    => req('PUT', `/playbooks/${id}`, body),
  deletePlaybook:(id)          => req('DELETE', `/playbooks/${id}`),

  // Intake fields
  listFields:    (playbookId)  => req('GET', `/playbooks/${playbookId}/fields`),
  createField:   (playbookId, body) => req('POST', `/playbooks/${playbookId}/fields`, body),
  updateField:   (id, body)    => req('PUT', `/fields/${id}`, body),
  deleteField:   (id)          => req('DELETE', `/fields/${id}`),
  reorderFields: (playbookId, order) => req('POST', `/playbooks/${playbookId}/fields/reorder`, { order }),

  // Steps
  listSteps:     (playbookId)  => req('GET', `/playbooks/${playbookId}/steps`),
  createStep:    (playbookId, body) => req('POST', `/playbooks/${playbookId}/steps`, body),
  updateStep:    (id, body)    => req('PUT', `/steps/${id}`, body),
  deleteStep:    (id)          => req('DELETE', `/steps/${id}`),
  reorderSteps:  (playbookId, order) => req('POST', `/playbooks/${playbookId}/steps/reorder`, { order }),

  // Components
  listComponents: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return req('GET', `/components${qs ? `?${qs}` : ''}`)
  },
  getComponent:   (id)   => req('GET', `/components/${id}`),
  createComponent:(body) => req('POST', '/components', body),
  updateComponent:(id, body) => req('PUT', `/components/${id}`, body),
  deleteComponent:(id)   => req('DELETE', `/components/${id}`),

  // Cases
  listCases: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return req('GET', `/cases${qs ? `?${qs}` : ''}`)
  },
  getCase:    (id)        => req('GET', `/cases/${id}`),
  createCase: (body)      => req('POST', '/cases', body),
  updateCase: (id, body)  => req('PUT', `/cases/${id}`, body),
  deleteCase: (id)        => req('DELETE', `/cases/${id}`),
}
