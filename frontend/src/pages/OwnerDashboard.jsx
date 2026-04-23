import { useCallback, useEffect, useState } from "react";
import client from "../api/client";
import DashboardLayout from "../layouts/DashboardLayout";

const initialSchoolForm = {
  name: "",
  code: "",
  address: "",
  contactEmail: "",
  allowNow: true
};

const OwnerDashboard = () => {
  const [data, setData] = useState({ items: [], allowedCount: 0, totalCount: 0 });
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [banner, setBanner] = useState("");
  const [schoolForm, setSchoolForm] = useState(initialSchoolForm);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await client.get("/owner/schools");
      setData(response.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load owner dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onFormChange = (field, value) => {
    setSchoolForm((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const createSchool = async (event) => {
    event.preventDefault();
    setBanner("");
    setError("");
    setCreating(true);

    try {
      const response = await client.post("/owner/schools", {
        name: schoolForm.name.trim(),
        code: schoolForm.code.trim().toUpperCase(),
        address: schoolForm.address.trim(),
        contactEmail: schoolForm.contactEmail.trim(),
        allowNow: schoolForm.allowNow
      });

      const created = response.data;
      setBanner(
        created.isAllowed
          ? `Added ${created.code} and allowed it for login/signup`
          : `Added ${created.code}. You can allow it later from the table.`
      );
      setSchoolForm(initialSchoolForm);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to add school");
    } finally {
      setCreating(false);
    }
  };

  const toggleAccess = async (school) => {
    setBanner("");
    setError("");

    try {
      if (school.isAllowed) {
        await client.delete(`/owner/schools/${school._id}/allow`);
        setBanner(`Removed ${school.code} from allowed list`);
      } else {
        await client.post(`/owner/schools/${school._id}/allow`);
        setBanner(`Allowed ${school.code} for login/signup`);
      }
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to update school access");
    }
  };

  return (
    <DashboardLayout title="Owner Dashboard">
      {loading ? <p className="card text-sm text-slate-500">Loading owner controls...</p> : null}
      {error ? <p className="card text-sm text-rose-700">{error}</p> : null}
      {banner ? <p className="card text-sm text-emerald-700">{banner}</p> : null}

      <div className="card">
        <h3 className="mb-3 text-lg font-semibold">Add School to Allowlist</h3>
        <form className="grid gap-3 md:grid-cols-2" onSubmit={createSchool}>
          <input
            className="input"
            placeholder="School Name"
            value={schoolForm.name}
            onChange={(event) => onFormChange("name", event.target.value)}
            required
          />
          <input
            className="input"
            placeholder="School Code"
            value={schoolForm.code}
            onChange={(event) => onFormChange("code", event.target.value.toUpperCase())}
            required
          />
          <input
            className="input"
            placeholder="Address (optional)"
            value={schoolForm.address}
            onChange={(event) => onFormChange("address", event.target.value)}
          />
          <input
            className="input"
            type="email"
            placeholder="Contact Email (optional)"
            value={schoolForm.contactEmail}
            onChange={(event) => onFormChange("contactEmail", event.target.value)}
          />
          <label className="flex items-center gap-2 text-sm text-slate-600 md:col-span-2 dark:text-slate-300">
            <input
              type="checkbox"
              checked={schoolForm.allowNow}
              onChange={(event) => onFormChange("allowNow", event.target.checked)}
            />
            Allow this school immediately for login/signup
          </label>
          <div className="md:col-span-2">
            <button className="btn-primary" disabled={creating} type="submit">
              {creating ? "Adding..." : "Add School"}
            </button>
          </div>
        </form>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card">
          <p className="text-sm text-slate-500">Total Schools</p>
          <p className="text-2xl font-bold">{data.totalCount}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">Allowed Schools</p>
          <p className="text-2xl font-bold">{data.allowedCount}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">Blocked Schools</p>
          <p className="text-2xl font-bold">{Math.max(0, data.totalCount - data.allowedCount)}</p>
        </div>
      </div>

      <div className="card">
        <h3 className="mb-3 text-lg font-semibold">School Access Control</h3>
        <p className="mb-4 text-sm text-slate-500">
          Only schools marked as <span className="font-semibold">Allowed</span> can register/login with their school code.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="pb-2">School</th>
                <th className="pb-2">Code</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Accounts</th>
                <th className="pb-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {(data.items || []).map((school) => (
                <tr key={school._id} className="border-t border-slate-200 dark:border-slate-700">
                  <td className="py-2">{school.name}</td>
                  <td>{school.code}</td>
                  <td>
                    <span className={school.isAllowed ? "text-emerald-600 font-semibold" : "text-rose-600 font-semibold"}>
                      {school.isAllowed ? "Allowed" : "Blocked"}
                    </span>
                  </td>
                  <td>
                    {school.accountSummary.totalAccounts} ({school.accountSummary.admins}A / {school.accountSummary.teachers}T / {school.accountSummary.students}S / {school.accountSummary.parents}P)
                  </td>
                  <td>
                    <button
                      className={school.isAllowed ? "btn-secondary" : "btn-primary"}
                      onClick={() => toggleAccess(school)}
                    >
                      {school.isAllowed ? "Remove" : "Allow"}
                    </button>
                  </td>
                </tr>
              ))}
              {!data.items?.length ? (
                <tr>
                  <td className="py-3 text-slate-500" colSpan={5}>
                    No schools found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default OwnerDashboard;
