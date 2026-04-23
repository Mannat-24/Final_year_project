import { useState } from "react";
import client from "../api/client";

const ResetPasswordPage = () => {
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      const { data } = await client.post("/auth/reset-password", { token, newPassword });
      setMessage(data.message);
    } catch (err) {
      setError(err.response?.data?.message || "Reset failed");
    }
  };

  return (
    <div className="min-h-screen p-4">
      <div className="mx-auto mt-10 max-w-md card">
        <h2 className="mb-4 text-2xl font-bold">Reset Password</h2>
        {message && <p className="mb-3 text-sm text-green-600">{message}</p>}
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <form className="space-y-3" onSubmit={submit}>
          <input className="input" placeholder="Reset Token" value={token} onChange={(e) => setToken(e.target.value)} />
          <input className="input" placeholder="New Password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          <button className="btn-primary w-full">Update Password</button>
        </form>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
