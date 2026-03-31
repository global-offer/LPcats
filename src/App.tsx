import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Editor from './pages/Editor'
import Analytics from './pages/Analytics'
import Embed from './pages/Embed'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/editor/:id" element={<Editor />} />
      <Route path="/editor/:id/analytics" element={<Analytics />} />
      <Route path="/editor/:id/embed" element={<Embed />} />
    </Routes>
  )
}
