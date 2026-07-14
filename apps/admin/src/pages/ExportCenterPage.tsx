import { useState } from "react";
import { api, Button, Card, CardContent, Input, Select, useAuthStore, useUIStore, ZONES } from "@oagf/ui";
import type { ExportFilter } from "@oagf/ui";

export function ExportCenterPage() {
  const { token } = useAuthStore();
  const addToast = useUIStore((state) => state.addToast);
  const [filter, setFilter] = useState<ExportFilter & { date_from?: string; date_to?: string; mda?: string }>({
    scope: "all",
  });

  async function handleExport(type: "csv" | "excel") {
    if (!token) return;
    try {
      const result =
        type === "csv"
          ? await api.exportCsv(token, filter, "")
          : await api.exportExcel(token, filter, "");
      addToast({
        type: "success",
        title: "Export Ready",
        message: `${result.filename} (${result.record_count} records) saved to ${result.path}`,
      });
    } catch (err) {
      addToast({ type: "error", title: "Error", message: err instanceof Error ? err.message : "Export failed" });
    }
  }

  const scopes = [
    { value: "all", label: "All Records" },
    { value: "verified", label: "Verified Only" },
    { value: "unverified", label: "Unverified Only" },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h2 className="text-2xl font-bold text-oagf-text">Data Export Center</h2>

      <Card>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Select
              label="Export Scope"
              value={filter.scope}
              onChange={(e) => setFilter({ ...filter, scope: e.target.value as ExportFilter["scope"] })}
              options={scopes}
            />
            <Select
              label="Zone"
              value={filter.zone ?? ""}
              onChange={(e) => setFilter({ ...filter, zone: e.target.value || undefined })}
              options={[{ value: "", label: "All Zones" }, ...ZONES.map((z) => ({ value: z, label: z }))]}
            />
            <Input
              label="MDA"
              value={filter.mda ?? ""}
              onChange={(e) => setFilter({ ...filter, mda: e.target.value || undefined })}
              placeholder="Filter by MDA name"
            />
            <div />
            <Input
              label="Date From"
              type="date"
              value={filter.date_from ?? ""}
              onChange={(e) => setFilter({ ...filter, date_from: e.target.value || undefined })}
            />
            <Input
              label="Date To"
              type="date"
              value={filter.date_to ?? ""}
              onChange={(e) => setFilter({ ...filter, date_to: e.target.value || undefined })}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button onClick={() => handleExport("csv")}>
              Export to CSV
            </Button>
            <Button variant="outline" onClick={() => handleExport("excel")}>
              Export to Excel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
