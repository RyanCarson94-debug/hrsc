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

export function useTasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await apiFetch('/tasks');
      setTasks(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const createTask = useCallback(async (fields = {}) => {
    const created = await apiFetch('/tasks', {
      method: 'POST',
      body: JSON.stringify(fields),
    });
    setTasks(prev => [...prev, created]);
    return created;
  }, []);

  const updateTask = useCallback(async (id, fields) => {
    const updated = await apiFetch(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(fields),
    });
    setTasks(prev => prev.map(t => (t.id === id ? updated : t)));
    return updated;
  }, []);

  const deleteTask = useCallback(async (id) => {
    await apiFetch(`/tasks/${id}`, { method: 'DELETE' });
    setTasks(prev => prev.filter(t => t.id !== id));
  }, []);

  return { tasks, loading, error, load, createTask, updateTask, deleteTask };
}
