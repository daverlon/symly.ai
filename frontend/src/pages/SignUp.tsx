import { useState } from "react"
import { signupAccount } from "../api/accountsApi"

export default function SignUp() {

    const [username, setUsername] = useState("")
    const [password, setPassword] = useState("")
    const [passwordConfirmation, setPasswordConfirmation] = useState("")

    async function handleSignUp(e: React.SubmitEvent) {
        e.preventDefault()
        try {
            const result = await signupAccount(username, password)
            console.log("login result:", result)
            alert(result);
        } catch (err) {
            console.error("signup failed.")
            alert("fail");
        }
    }

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-gray-200">

      <form
        onSubmit={handleSignUp}
        className="bg-white p-8 rounded-xl shadow-md w-80"
      >

        <h1 className="text-xl mb-6 font-semibold">Create New Account</h1>

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

        <input
            type="password"
            placeholder="Confirm Password"
            value={passwordConfirmation}
            onChange={(e) => setPasswordConfirmation(e.target.value)}
            className="border w-full p-2 mb-4 rounded"
        />

        <div className="mb-4">
        {password === passwordConfirmation ? (
            <p>Passwords match</p>
            ) : (
            <p>Passwords do not match</p>
        )}
        </div>

        <button
          type="submit"
          className="bg-blue-500 text-white w-full p-2 rounded"
        >
          Create
        </button>

      </form>

    </div>
  )
}