import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './index.css'
import Home from './pages/Home'
import Login from './pages/Login'
import SignUp from './pages/SignUp'
import Dashboard from './pages/Dashboard'

function App() {
  return (
    <BrowserRouter>
    <Routes>
      <Route path="/" element = {<Home />} />
      <Route path="/home" element = {<Home />} />

      <Route path="/login" element = {<Login />} />
      <Route path="/signup" element = {<SignUp />} />
      <Route path="/dashboard" element = {<Dashboard />} />
    </Routes>
    </BrowserRouter>

  )
}

export default App
