import { useEffect, useState } from "react";
import { Database } from "lucide-react";
import { api, Button, Card, CardContent, useAuthStore, useUIStore } from "@oagf/ui";

export function DatabasePage() {
  const { token } = useAuthStore();
  const addToast = useUIStore((state) => state.addToast);
  const [backingUp, setBackingUp] = useState(false);
  const [vacuuming, setVacuuming] = useState(false);
  const [storage, setStorage] = useState({
    db_size: 0,
    photo_folder_size: 0,
    total_records: 0,
  });

  useEffect(() => {
    if (!token) return;
    api
      .storageInfo(token)
      .then(setStorage)
      .catch((err) => addToast({ type: "error", title: "Error", message: err instanceof Error ? err.message : "Failed to load storage info" }));
  }, [token, addToast]);

  async function handleBackup() {
    if (!token) return;
    setBackingUp(true);
    try {
      const result = await api.backupDatabase(token, "");
      addToast({ type: "success", title: "Backup Complete", message: `Saved as ${result.filename}` });
    } catch (err) {
      addToast({ type: "error", title: "Error", message: err instanceof Error ? err.message : "Backup failed" });
    } finally {
      setBackingUp(false);
    }
  }

  function handleRestore() {
    addToast({ type: "warning", title: "Not Implemented", message: "Restore will be wired to the Rust backend." });
  }

  async function handleVacuum() {
    if (!token) return;
    setVacuuming(true);
    try {
      await api.vacuumDatabase(token);
      const updated = await api.storageInfo(token);
      setStorage(updated);
      addToast({ type: "success", title: "Vacuum Complete", message: "Database compacted successfully." });
    } catch (err) {
      addToast({ type: "error", title: "Error", message: err instanceof Error ? err.message : "Vacuum failed" });
    } finally {
      setVacuuming(false);
    }
  }

  function formatBytes(bytes: number) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  const stats = [
    { label: "Database Size", value: formatBytes(storage.db_size), icon: Database },
    { label: "Photo Folder", value: formatBytes(storage.photo_folder_size), icon: Database },
    { label: "Total Records", value: `${storage.total_records} pensioners`, icon: Database },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h2 className="text-2xl font-bold text-oagf-text">Database Management</h2>

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardContent className="flex items-center gap-3">
                <Icon className="text-oagf-green" size={24} />
                <div>
                  <p className="text-xs text-oagf-grey">{s.label}</p>
                  <p className="text-lg font-bold text-oagf-text">{s.value}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardContent className="space-y-4">
          <h3 className="text-lg font-semibold text-oagf-text">Backup & Restore</h3>
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleBackup} isLoading={backingUp}>
              Backup Database
            </Button>
            <Button variant="outline" onClick={handleRestore}>
              Restore Database
            </Button>
            <Button variant="outline" onClick={handleVacuum} isLoading={vacuuming}>
              Compact / Vacuum
            </Button>
          </div>
          <p className="text-sm text-oagf-grey">
            Restore will overwrite the current database. Ensure you have a recent backup before proceeding.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
