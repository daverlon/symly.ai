import { useState } from "react"
import { signupAccount } from "../api/accountsApi"
import { Link } from "react-router-dom"

export default function SignUp() {

    const [username, setUsername] = useState("")
    const [password, setPassword] = useState("")
    const [passwordConfirmation, setPasswordConfirmation] = useState("")

    async function handleSignUp(e: React.SubmitEvent) {
        e.preventDefault()
        if (!(password===passwordConfirmation)) {
            alert("Password confirmation must match.");
            return;
        }
        try {
            const result = await signupAccount(username, password)
            console.log("login result:", result)
            alert(result);
        } catch (err) {
            console.error("signup failed.")
            if (err instanceof Error) {
                alert(err.message);
            }
        }
    }

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-gray-200">


      <div className="w-80">
        <Link to="/" className="bg-blue-300 rounded-sm px-5 text-center self-start">Back</Link>
    </div>

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