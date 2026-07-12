import { useEffect, useState } from "react";
import {
  api,
  Badge,
  Button,
  Card,
  CardContent,
  formatDateTime,
  Input,
  Modal,
  ROLES,
  Select,
  useAuthStore,
  useUIStore,
} from "@oagf/ui";
import type { Role, User } from "@oagf/ui";

export function UsersPage() {
  const { token, user: currentUser } = useAuthStore();
  const addToast = useUIStore((state) => state.addToast);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [form, setForm] = useState({ full_name: "", username: "", role: "clerk" as Role });

  async function load() {
    if (!token) return;
    setLoading(true);
    try {
      const data = await api.listUsers(token);
      setUsers(data);
    } catch (err) {
      addToast({ type: "error", title: "Error", message: err instanceof Error ? err.message : "Failed to load users" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    try {
      const result = await api.createUser(token, form);
      setTempPassword(result.temp_password);
      addToast({ type: "success", title: "Created", message: `User ${result.user.username} created.` });
      load();
    } catch (err) {
      addToast({ type: "error", title: "Error", message: err instanceof Error ? err.message : "Failed to create user" });
    }
  }

  async function toggleActive(u: User) {
    if (!token) return;
    try {
      await api.updateUser(token, u.id, { is_active: !u.is_active });
      addToast({ type: "success", title: "Updated", message: "User status updated." });
      load();
    } catch (err) {
      addToast({ type: "error", title: "Error", message: err instanceof Error ? err.message : "Failed to update user" });
    }
  }

  async function resetPassword(u: User) {
    if (!token) return;
    try {
      const result = await api.resetPassword(token, u.id);
      setTempPassword(result.temp_password);
      addToast({ type: "success", title: "Reset", message: `Password reset for ${u.username}.` });
    } catch (err) {
      addToast({ type: "error", title: "Error", message: err instanceof Error ? err.message : "Failed to reset password" });
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-oagf-text">User Management</h2>
        <Button onClick={() => { setModalOpen(true); setTempPassword(null); setForm({ full_name: "", username: "", role: "clerk" }); }}>
          Add User
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-oagf-border">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-oagf-grey">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-oagf-grey">Username</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-oagf-grey">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-oagf-grey">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-oagf-grey">Last Login</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-oagf-grey">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-oagf-border">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-oagf-text">{u.full_name}</td>
                    <td className="px-4 py-3 text-sm text-oagf-text">{u.username}</td>
                    <td className="px-4 py-3 text-sm capitalize text-oagf-text">{u.role}</td>
                    <td className="px-4 py-3">
                      <Badge variant={u.is_active ? "green" : "red"}>{u.is_active ? "Active" : "Inactive"}</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-oagf-grey">{formatDateTime(u.last_login)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => resetPassword(u)}>Reset</Button>
                        {u.id !== currentUser?.id && (
                          <Button size="sm" variant={u.is_active ? "danger" : "success"} onClick={() => toggleActive(u)}>
                            {u.is_active ? "Deactivate" : "Activate"}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Add New User">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input label="Full Name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
          <Input label="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
          <Select label="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })} options={ROLES.map((r) => ({ value: r, label: r.charAt(0).toUpperCase() + r.slice(1) }))} required />
          {tempPassword && (
            <div className="rounded-lg bg-oagf-green-light p-3 text-sm text-oagf-green-dark">
              <p className="font-semibold">Temporary password (show once):</p>
              <p className="font-mono text-lg">{tempPassword}</p>
            </div>
          )}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Close</Button>
            {!tempPassword && <Button type="submit" isLoading={loading}>Create User</Button>}
          </div>
        </form>
      </Modal>
    </div>
  );
}
