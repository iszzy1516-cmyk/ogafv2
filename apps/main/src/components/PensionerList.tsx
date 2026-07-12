import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import {
  api,
  Badge,
  Button,
  DataTable,
  DEFAULT_PAGE_SIZE,
  formatNaira,
  Input,
  Modal,
  useAuthStore,
  useUIStore,
} from "@oagf/ui";
import type { Column, Pensioner, PensionerStatus } from "@oagf/ui";

interface PensionerListProps {
  status: PensionerStatus;
  title: string;
}

export function PensionerList({ status, title }: PensionerListProps) {
  const { token, user } = useAuthStore();
  const addToast = useUIStore((state) => state.addToast);
  const navigate = useNavigate();

  const [data, setData] = useState<Pensioner[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [verifyId, setVerifyId] = useState<string | null>(null);
  const [verifyNotes, setVerifyNotes] = useState("");

  const isAdmin = user?.role === "admin";
  const canVerify = user?.role === "verifier" || isAdmin;

  async function load() {
    if (!token) return;
    try {
      const res = await api.listPensioners(token, { status, search }, { page, per_page: perPage });
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
  }, [token, status, page, perPage, search]);

  async function handleDelete() {
    if (!deleteId || !token) return;
    try {
      await api.deletePensioner(token, deleteId);
      addToast({ type: "success", title: "Deleted", message: "Record deleted." });
      setDeleteId(null);
      load();
    } catch (err) {
      addToast({ type: "error", title: "Error", message: err instanceof Error ? err.message : "Failed to delete record" });
    }
  }

  async function handleVerify() {
    if (!verifyId || !token) return;
    try {
      await api.verifyPensioner(token, verifyId, verifyNotes || undefined);
      addToast({ type: "success", title: "Verified", message: "Record verified successfully." });
      setVerifyId(null);
      setVerifyNotes("");
      load();
    } catch (err) {
      addToast({ type: "error", title: "Error", message: err instanceof Error ? err.message : "Failed to verify record" });
    }
  }

  async function handleReject() {
    if (!verifyId || !token) return;
    try {
      await api.rejectPensioner(token, verifyId, verifyNotes || undefined);
      addToast({ type: "warning", title: "Rejected", message: "Record rejected." });
      setVerifyId(null);
      setVerifyNotes("");
      load();
    } catch (err) {
      addToast({ type: "error", title: "Error", message: err instanceof Error ? err.message : "Failed to reject record" });
    }
  }

  const moneyCell = (value: number) => <span className="tabular-figures">{formatNaira(value)}</span>;

  const columns: Column<Pensioner>[] = [
    { key: "full_name", header: "Employee Name", width: "200px" },
    { key: "apa", header: "APA", width: "120px", render: (row) => moneyCell(row.apa) },
    { key: "gratuity", header: "Gratuity", width: "140px", render: (row) => moneyCell(row.gratuity) },
    { key: "pension", header: "Pension", width: "140px", render: (row) => moneyCell(row.pension) },
    { key: "ten_percent_gratuity", header: "10% Grat.", width: "120px", render: (row) => moneyCell(row.ten_percent_gratuity) },
    { key: "ten_percent_pension", header: "10% Pens.", width: "120px", render: (row) => moneyCell(row.ten_percent_pension) },
    {
      key: "status",
      header: "Status",
      width: "130px",
      render: (row) => {
        const variant = row.status.toLowerCase() as "verified" | "unverified" | "rejected";
        return <Badge variant={variant}>{row.status}</Badge>;
      },
    },
    {
      key: "actions",
      header: "Action",
      width: "150px",
      render: (row) => (
        <div className="flex items-center justify-start gap-1.5">
          {status === "Unverified" && canVerify && (
            <Button
              size="sm"
              variant="success"
              className="px-2 py-1 text-xs"
              onClick={() => setVerifyId(row.id)}
            >
              Verify
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="px-2 py-1 text-xs"
            onClick={() => navigate(`/evaluation/${row.id}`)}
          >
            Edit
          </Button>
          {status === "Unverified" && (isAdmin || row.created_by === user?.id) && (
            <Button
              size="sm"
              variant="danger"
              className="px-2 py-1 text-xs"
              onClick={() => setDeleteId(row.id)}
            >
              Delete
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
          <p className="mt-1 text-sm text-oagf-grey">Manage pensioner records and verification status</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-oagf-grey" size={18} />
            <Input
              placeholder="Search by name..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-10 sm:w-64"
            />
          </div>
        </div>
      </div>

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

      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Confirm Delete">
        <p className="mb-5 text-sm text-gray-600">Are you sure you want to delete this record? This action cannot be undone.</p>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>

      <Modal isOpen={!!verifyId} onClose={() => setVerifyId(null)} title="Verify Record">
        <div className="space-y-4">
          <Input
            label="Verification Notes"
            value={verifyNotes}
            onChange={(e) => setVerifyNotes(e.target.value)}
            placeholder="Optional notes"
          />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setVerifyId(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleReject}>Reject</Button>
            <Button onClick={handleVerify}>Verify</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
