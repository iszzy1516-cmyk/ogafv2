import { useEffect, useState } from "react";
import { api, Card, CardContent, formatDateTime, formatNaira, useAuthStore, useUIStore } from "@oagf/ui";
import type { AuditLog, DashboardStats, Pensioner } from "@oagf/ui";

export function DashboardPage() {
  const { token, user } = useAuthStore();
  const addToast = useUIStore((state) => state.addToast);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentLogs, setRecentLogs] = useState<AuditLog[]>([]);
  const [recentRecords, setRecentRecords] = useState<Pensioner[]>([]);
  const [storage, setStorage] = useState({ db_size: 0, photo_folder_size: 0, total_records: 0 });

  useEffect(() => {
    if (!token) return;

    api
      .getDashboardStats(token)
      .then(setStats)
      .catch((err) => addToast({ type: "error", title: "Error", message: err.message }));

    api
      .listAuditLogs(token, {}, { page: 1, per_page: 5 })
      .then((res) => setRecentLogs(res.data))
      .catch((err) => addToast({ type: "error", title: "Error", message: err.message }));

    api
      .listPensioners(token, {}, { page: 1, per_page: 5 })
      .then((res) => setRecentRecords(res.data))
      .catch((err) => addToast({ type: "error", title: "Error", message: err.message }));

    api
      .storageInfo(token)
      .then(setStorage)
      .catch(() => {});
  }, [token, addToast]);

  const cards = [
    { label: "Total Pensioners", value: stats?.total_pensioners ?? 0 },
    { label: "Unverified", value: stats?.unverified_count ?? 0 },
    { label: "Verified", value: stats?.verified_count ?? 0 },
    { label: "Rejected", value: stats?.rejected_count ?? 0 },
    { label: "Total Liability", value: formatNaira(stats?.total_liability ?? 0) },
    { label: "Total Paid by OAGF", value: formatNaira(stats?.total_paid ?? 0) },
  ];

  function formatBytes(bytes: number) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  return (
    <div className="mx-auto max-w-[1280px] space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-oagf-text">Admin Dashboard</h2>
          <p className="text-sm text-oagf-grey">Welcome, {user?.full_name}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardContent className="flex items-center gap-4">
              <div>
                <p className="text-sm text-oagf-grey">{card.label}</p>
                <p className="text-2xl font-bold text-oagf-text">{card.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="p-0">
            <div className="border-b border-gray-100 px-6 py-4">
              <h3 className="font-semibold text-oagf-text">Recent Activity</h3>
              <p className="text-sm text-oagf-grey">Latest actions across the system</p>
            </div>
            {recentLogs.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-oagf-grey">No recent activity</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {recentLogs.map((log) => (
                  <li key={log.id} className="px-6 py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-oagf-text">{log.action}</span>
                      <span className="text-xs text-oagf-grey">{formatDateTime(log.performed_at)}</span>
                    </div>
                    <p className="text-xs text-oagf-grey">
                      {log.user_name || "System"}
                      {log.table_name && ` · ${log.table_name}`}
                      {log.record_id && ` · ${log.record_id.slice(0, 8)}`}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="border-b border-gray-100 px-6 py-4">
              <h3 className="font-semibold text-oagf-text">Recent Records Added</h3>
              <p className="text-sm text-oagf-grey">New pensioner submissions</p>
            </div>
            {recentRecords.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-oagf-grey">No records found</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {recentRecords.map((record) => (
                  <li key={record.id} className="px-6 py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-oagf-text">{record.full_name}</span>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                        {record.status}
                      </span>
                    </div>
                    <p className="text-xs text-oagf-grey">
                      {record.mda_name || "No MDA"} · {formatDateTime(record.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="grid gap-6 sm:grid-cols-3">
          <div>
            <p className="text-sm text-oagf-grey">Database Size</p>
            <p className="text-lg font-semibold text-oagf-text">{formatBytes(storage.db_size)}</p>
          </div>
          <div>
            <p className="text-sm text-oagf-grey">Photo Storage</p>
            <p className="text-lg font-semibold text-oagf-text">{formatBytes(storage.photo_folder_size)}</p>
          </div>
          <div>
            <p className="text-sm text-oagf-grey">Total Records Stored</p>
            <p className="text-lg font-semibold text-oagf-text">{storage.total_records}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
