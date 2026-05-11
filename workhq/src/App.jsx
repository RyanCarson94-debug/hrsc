import { useState, useEffect, useCallback } from 'react';
import { useTasks } from './hooks/useTasks.js';
import { useProjects } from './hooks/useProjects.js';
import Dashboard from './components/Dashboard.jsx';
import TaskList from './components/TaskList.jsx';
import Projects from './components/Projects.jsx';

const TABS = ['Dashboard', 'Tasks', 'Projects'];

async function seedDB() {
  await fetch('/api/workhq/seed', { method: 'POST' });
}

export default function App() {
  const [tab, setTab] = useState('Dashboard');
  const { tasks, loading: tasksLoading, error: tasksError, load: loadTasks, createTask, updateTask, deleteTask } = useTasks();
  const { projects, loading: projLoading, error: projError, load: loadProjects, createProject, updateProject, deleteProject } = useProjects();

  useEffect(() => {
    // Seed first (no-op if data exists), then load
    seedDB()
      .catch(() => {})
      .finally(() => {
        loadTasks();
        loadProjects();
      });
  }, [loadTasks, loadProjects]);

  // updateTask wrapper that also refreshes from DB for dashboard consistency
  const handleUpdateTask = useCallback(async (id, fields) => {
    await updateTask(id, fields);
  }, [updateTask]);

  const loading = tasksLoading || projLoading;

  return (
    <div className="app-shell">
      <header className="topbar">
        <span className="topbar-brand">Work <span>HQ</span></span>
        <nav className="topbar-nav">
          {TABS.map(t => (
            <button
              key={t}
              className={`nav-btn${tab === t ? ' active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t === 'Dashboard' ? '⬛ Dashboard' : t === 'Tasks' ? '☑ Tasks' : '📁 Projects'}
            </button>
          ))}
        </nav>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap' }}>
          HRSC · Ryan Carson
        </span>
      </header>

      <main className="page-content">
        {loading && (
          <div className="loading-state">
            <span style={{ fontSize: 20 }}>⟳</span>
            Loading your workspace…
          </div>
        )}

        {!loading && tab === 'Dashboard' && (
          <Dashboard
            tasks={tasks}
            updateTask={handleUpdateTask}
          />
        )}

        {!loading && tab === 'Tasks' && (
          <TaskList
            tasks={tasks}
            createTask={createTask}
            updateTask={handleUpdateTask}
            deleteTask={deleteTask}
            error={tasksError}
          />
        )}

        {!loading && tab === 'Projects' && (
          <Projects
            projects={projects}
            createProject={createProject}
            updateProject={updateProject}
            deleteProject={deleteProject}
            error={projError}
          />
        )}
      </main>
    </div>
  );
}
