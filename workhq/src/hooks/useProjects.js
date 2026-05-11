import { useState, useCallback } from 'react';

const BASE = '/api/workhq';

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

export function useProjects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await apiFetch('/projects');
      setProjects(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const createProject = useCallback(async (fields = {}) => {
    const created = await apiFetch('/projects', {
      method: 'POST',
      body: JSON.stringify(fields),
    });
    setProjects(prev => [...prev, created]);
    return created;
  }, []);

  const updateProject = useCallback(async (id, fields) => {
    const updated = await apiFetch(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(fields),
    });
    setProjects(prev => prev.map(p => (p.id === id ? updated : p)));
    return updated;
  }, []);

  const deleteProject = useCallback(async (id) => {
    await apiFetch(`/projects/${id}`, { method: 'DELETE' });
    setProjects(prev => prev.filter(p => p.id !== id));
  }, []);

  return { projects, loading, error, load, createProject, updateProject, deleteProject };
}
