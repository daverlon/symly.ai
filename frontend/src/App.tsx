import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './index.css'
import Home from './pages/Home'
import Login from './pages/Login'
import SignUp from './pages/SignUp'
import Dashboard from './pages/Dashboard'
import UploadSession from './pages/UploadSession'
import { ProtectedRoute } from './components/ProtectedRoute'

function App() {
  return (
    <BrowserRouter>
    <Routes>
      <Route path="/" element = {<Home />} />
      <Route path="/home" element = {<Home />} />

      <Route path="/login" element = {<Login />} />
      <Route path="/signup" element = {<SignUp />} />
      <Route path="/dashboard" element = {<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/dashboard/session/:sessionId" element = {<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/uploadSession" element = {<UploadSession />} />
    </Routes>
    </BrowserRouter>

  )
}

export default App
