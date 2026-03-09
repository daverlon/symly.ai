import { useState } from "react"
import { signupAccount } from "../api/accountsApi"

export default function Login() {

  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")

  async function handleLogin(e: React.SubmitEvent) {
    e.preventDefault()
    try {
        const result = await signupAccount(username, password)
        console.log("login result:", result)
        // alert("Accont created!");
    } catch (err) {
        console.error ("login failed", err)
    }
  }

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-gray-200">

      <form
        onSubmit={handleLogin}
        className="bg-white p-8 rounded-xl shadow-md w-80"
      >

        <h1 className="text-xl mb-6 font-semibold">Login</h1>

        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="border w-full p-2 mb-4 rounded"
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border w-full p-2 mb-4 rounded"
        />

        <button
          type="submit"
          className="bg-blue-500 text-white w-full p-2 rounded"
        >
          Login
        </button>

      </form>
    </div>
  )
}