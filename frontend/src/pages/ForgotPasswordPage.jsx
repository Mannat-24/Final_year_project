import { useState } from "react";
import { Link } from "react-router-dom";
import client from "../api/client";

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [response, setResponse] = useState(null);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const { data } = await client.post("/auth/forgot-password", { email });
      setResponse(data);
    } catch (err) {
      setError(err.response?.data?.message || "Request failed");
    }
  };

  return (
    <div className="min-h-screen p-4">
      <div className="mx-auto mt-10 max-w-md card">
        <h2 className="mb-4 text-2xl font-bold">Forgot Password</h2>
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <form className="space-y-3" onSubmit={submit}>
          <input className="input" placeholder="Registered Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="btn-primary w-full">Generate Reset Token</button>
        </form>
        {response && (
          <div className="mt-4 rounded-xl bg-slate-100 p-3 text-sm dark:bg-slate-800">
            <p>{response.message}</p>
            {response.resetToken && <p className="mt-1 break-all">Token: {response.resetToken}</p>}
          </div>
        )}
        <p className="mt-3 text-sm"><Link className="text-brand-700" to="/reset-password">Go to reset page</Link></p>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
