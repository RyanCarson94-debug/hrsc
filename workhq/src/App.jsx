import { useState, useEffect, useCallback } from 'react';
import { useTasks } from './hooks/useTasks.js';
import { useProjects } from './hooks/useProjects.js';
import Dashboard from './components/Dashboard.jsx';
import TaskList from './components/TaskList.jsx';
import Projects from './components/Projects.jsx';
import Meetings from './components/Meetings.jsx';

const TABS = [
  { id: 'Dashboard', label: 'Dashboard', icon: '◈' },
  { id: 'Tasks',     label: 'Tasks',     icon: '✓' },
  { id: 'Projects',  label: 'Projects',  icon: '◉' },
  { id: 'Meetings',  label: 'Meetings',  icon: '📅' },
];

async function seedDB() {
  await fetch('/api/workhq/seed', { method: 'POST' });
}

export default function App() {
  const [tab, setTab] = useState('Dashboard');
  const { tasks, loading: tasksLoading, error: tasksError, load: loadTasks, createTask, updateTask, deleteTask } = useTasks();

  const { projects, loading: projLoading, error: projError, load: loadProjects, createProject, updateProject, deleteProject } = useProjects();

  useEffect(() => {
    seedDB()
      .catch(() => {})
      .finally(() => {
        loadTasks();
        loadProjects();
      });
  }, [loadTasks, loadProjects]);

  const handleUpdateTask = useCallback(async (id, fields) => {
    await updateTask(id, fields);
  }, [updateTask]);

  const loading = tasksLoading || projLoading;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-brand">
          <div className="brand-icon">🏢</div>
          Work <span>HQ</span>
        </div>
        <nav className="topbar-nav">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`nav-btn${tab === t.id ? ' active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <span>{t.icon}</span> {t.label}
            </button>
          ))}
        </nav>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap' }}>
          HRSC · Ryan
        </span>
      </header>

      <main className="page-content">
        {loading && (
          <div className="loading-state">
            <div className="loading-spinner" />
            Loading your workspace…
          </div>
        )}

        {!loading && tab === 'Dashboard' && (
          <Dashboard tasks={tasks} updateTask={handleUpdateTask} onNavigate={setTab} />
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

        {tab === 'Meetings' && (
          <Meetings
            tasks={tasks}
            onTaskCreated={task => {
              // Refresh task list to include the new action
              loadTasks();
            }}
          />
        )}
      </main>
    </div>
  );
}
