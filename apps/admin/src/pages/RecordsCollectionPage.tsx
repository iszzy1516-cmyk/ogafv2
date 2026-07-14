import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Filter } from "lucide-react";
import {
  api,
  Badge,
  Button,
  Card,
  CardContent,
  DataTable,
  DEFAULT_PAGE_SIZE,
  formatDate,
  formatNaira,
  Input,
  Select,
  useAuthStore,
  useUIStore,
  ZONES,
} from "@oagf/ui";
import type { Column, Pensioner } from "@oagf/ui";

export function RecordsCollectionPage() {
  const { token } = useAuthStore();
  const addToast = useUIStore((state) => state.addToast);
  const navigate = useNavigate();

  const [data, setData] = useState<Pensioner[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("");
  const [zone, setZone] = useState<string>("");
  const [mda, setMda] = useState<string>("");

  async function load() {
    if (!token) return;
    try {
      const res = await api.listPensioners(
        token,
        {
          status: status ? (status as Pensioner["status"]) : undefined,
          search: search || undefined,
          mda: mda || undefined,
          zone: zone || undefined,
        },
        { page, per_page: perPage },
      );
      setData(res.data);
      setTotal(res.total);
      if (res.page !== page) setPage(res.page);
    } catch (err) {
      addToast({ type: "error", title: "Error", message: err instanceof Error ? err.message : "Failed to load records" });
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, page, perPage, search, status, zone, mda]);

  async function handleExport(scope: "all" | "verified" | "unverified") {
    if (!token) return;
    try {
      const result = await api.exportCsv(token, { scope }, "");
      addToast({ type: "success", title: "Export Ready", message: `${result.filename} (${result.record_count} records) saved to ${result.path}` });
    } catch (err) {
      addToast({ type: "error", title: "Error", message: err instanceof Error ? err.message : "Export failed" });
    }
  }

  const moneyCell = (value: number) => <span className="tabular-figures">{formatNaira(value)}</span>;

  const columns: Column<Pensioner>[] = [
    { key: "full_name", header: "Employee Name" },
    { key: "mda_name", header: "MDA" },
    { key: "zone", header: "Zone" },
    { key: "apa", header: "APA", render: (row) => moneyCell(row.apa) },
    { key: "gratuity", header: "Gratuity", render: (row) => moneyCell(row.gratuity) },
    { key: "pension", header: "Pension", render: (row) => moneyCell(row.pension) },
    { key: "due_for_payment_by_oagf", header: "Due for Payment", render: (row) => moneyCell(row.due_for_payment_by_oagf) },
    {
      key: "status",
      header: "Status",
      render: (row) => {
        const variant = row.status.toLowerCase() as "verified" | "unverified" | "rejected";
        return <Badge variant={variant}>{row.status}</Badge>;
      },
    },
    { key: "created_at", header: "Created", render: (row) => formatDate(row.created_at) },
    {
      key: "actions",
      header: "Action",
      render: (row) => (
        <Button size="sm" variant="outline" onClick={() => navigate(`/records/${row.id}`)}>
          View
        </Button>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-bold text-oagf-text">Records Collection</h2>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => handleExport("all")}>
            Export All
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-oagf-grey" size={18} />
            <Input
              placeholder="Search by name..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-10"
            />
          </div>
          <Select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            options={[
              { value: "", label: "All Statuses" },
              { value: "Unverified", label: "Unverified" },
              { value: "Verified", label: "Verified" },
              { value: "Rejected", label: "Rejected" },
            ]}
          />
          <Select
            value={zone}
            onChange={(e) => { setZone(e.target.value); setPage(1); }}
            options={[{ value: "", label: "All Zones" }, ...ZONES.map((z) => ({ value: z, label: z }))]}
          />
          <Input
            placeholder="Filter by MDA"
            value={mda}
            onChange={(e) => { setMda(e.target.value); setPage(1); }}
          />
          <div className="flex items-center gap-2 text-sm text-oagf-grey">
            <Filter size={18} />
            <span>{total} records</span>
          </div>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={data}
        keyExtractor={(row) => row.id}
        page={page}
        perPage={perPage}
        total={total}
        onPageChange={setPage}
        onPerPageChange={(size) => { setPerPage(size); setPage(1); }}
      />
    </div>
  );
}
