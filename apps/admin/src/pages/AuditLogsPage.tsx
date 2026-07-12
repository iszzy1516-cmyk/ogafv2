import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Search } from "lucide-react";
import {
  api,
  AUDIT_ACTIONS,
  Button,
  Card,
  CardContent,
  DataTable,
  DEFAULT_PAGE_SIZE,
  formatDateTime,
  Input,
  Select,
  useAuthStore,
  useUIStore,
} from "@oagf/ui";
import type { AuditLog, Column } from "@oagf/ui";

export function AuditLogsPage() {
  const { token } = useAuthStore();
  const addToast = useUIStore((state) => state.addToast);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(DEFAULT_PAGE_SIZE);
  const [action, setAction] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    if (!token) return;
    try {
      const res = await api.listAuditLogs(token, { action: action || undefined }, { page, per_page: perPage });
      setLogs(res.data);
      setTotal(res.total);
    } catch (err) {
      addToast({ type: "error", title: "Error", message: err instanceof Error ? err.message : "Failed to load audit logs" });
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, page, perPage, action]);

  async function handleExport() {
    if (!token) return;
    try {
      const result = await api.exportCsv(token, { scope: "audit" }, "");
      addToast({ type: "success", title: "Export Ready", message: `${result.filename} with ${result.record_count} records.` });
    } catch (err) {
      addToast({ type: "error", title: "Error", message: err instanceof Error ? err.message : "Export failed" });
    }
  }

  const columns: Column<AuditLog>[] = [
    { key: "performed_at", header: "Date/Time", render: (row) => formatDateTime(row.performed_at) },
    { key: "user_name", header: "User" },
    { key: "action", header: "Action" },
    { key: "table_name", header: "Table" },
    { key: "record_id", header: "Record ID", render: (row) => <span className="font-mono text-xs">{row.record_id ?? "—"}</span> },
    {
      key: "details",
      header: "Details",
      render: (row) => (
        <Button size="sm" variant="ghost" onClick={() => setExpanded(expanded === row.id ? null : row.id)}>
          {expanded === row.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </Button>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-bold text-oagf-text">Audit Log Viewer</h2>
        <Button variant="outline" onClick={handleExport}>
          Export Audit Log
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-oagf-grey" size={18} />
            <Input placeholder="Filter by user..." className="pl-10" />
          </div>
          <Select
            value={action}
            onChange={(e) => { setAction(e.target.value); setPage(1); }}
            options={[{ value: "", label: "All Actions" }, ...Object.values(AUDIT_ACTIONS).map((a) => ({ value: a, label: a }))]}
          />
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={logs}
        keyExtractor={(row) => row.id}
        page={page}
        perPage={perPage}
        total={total}
        onPageChange={setPage}
        onPerPageChange={(size) => { setPerPage(size); setPage(1); }}
      />

      {expanded && (
        <Card>
          <CardContent>
            <h3 className="mb-2 font-semibold text-oagf-text">Diff Details</h3>
            {(() => {
              const row = logs.find((l) => l.id === expanded);
              if (!row) return null;
              return (
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="mb-1 text-xs font-semibold text-oagf-grey">Old Values</p>
                    <pre className="max-h-60 overflow-auto rounded-lg bg-gray-50 p-3 text-xs text-oagf-text">
                      {JSON.stringify(row.old_values ?? {}, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-semibold text-oagf-grey">New Values</p>
                    <pre className="max-h-60 overflow-auto rounded-lg bg-gray-50 p-3 text-xs text-oagf-text">
                      {JSON.stringify(row.new_values ?? {}, null, 2)}
                    </pre>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
