import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './index.css'
import Dashboard from './pages/Dashboard'
import UploadSession from './pages/UploadSession'
import InvalidRoute from './pages/InvalidRoute'

function App() {
  return (
    <BrowserRouter>
    <Routes>
      <Route path="/" element = {<Dashboard />} />
      <Route path="/dashboard" element = {<Dashboard />} />
      <Route path="/dashboard/s/:sessionId" element={<Dashboard />} />
      <Route path="/u/:uploadKey" element = {<UploadSession />} />
      <Route path="*" element={<InvalidRoute />} />
    </Routes>
    </BrowserRouter>

  )
}

export default App
