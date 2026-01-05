import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import GameEditor from './pages/GameEditor'
import GamePreview from './pages/GamePreview'
import LLMConfig from './pages/LLMConfig'
import './App.css'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/editor" element={<GameEditor />} />
        <Route path="/preview" element={<GamePreview />} />
        <Route path="/llm-config" element={<LLMConfig />} />
      </Routes>
    </Router>
  )
}

export default App
