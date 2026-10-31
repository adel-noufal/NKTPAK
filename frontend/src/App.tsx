import React from 'react'
import { Routes, Route } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { Dashboard } from './pages/Dashboard'
import { NewProject } from './pages/NewProject'
import { ProjectDetail } from './pages/ProjectDetail'
import { ProjectsList } from './pages/ProjectsList'
import { Standards } from './pages/Standards'
// Settings page removed in v6 — language and theme moved to header

export const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="projects/new" element={<NewProject />} />
        <Route path="projects/:id" element={<ProjectDetail />} />
        <Route path="projects" element={<ProjectsList />} />
        <Route path="standards" element={<Standards />} />
      </Route>
    </Routes>
  )
}

export default App
