import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './index.css'
import Home from './pages/Home'
import Login from './pages/Login'
import SignUp from './pages/SignUp'
import Dashboard from './pages/Dashboard'
import UploadSession from './pages/UploadSession'
import { ProtectedRoute } from './components/ProtectedRoute'
import InvalidRoute from './pages/InvalidRoute'

function App() {
  return (
    <BrowserRouter>
    <Routes>
      <Route path="/" element = {<Home />} />
      <Route path="/home" element = {<Home />} />

      <Route path="/login" element = {<Login />} />
      <Route path="/signup" element = {<SignUp />} />
      <Route path="/dashboard" element = {<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/dashboard/s/:sessionId" element = {<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/u/:uploadKey" element = {<UploadSession />} />

      <Route path="*" element={<InvalidRoute />} />

    </Routes>
    </BrowserRouter>

  )
}

export default App
