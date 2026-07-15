import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileSpreadsheet, FileText, Printer, Search } from "lucide-react";
import {
  api,
  Badge,
  Button,
  DataTable,
  DEFAULT_PAGE_SIZE,
  formatNaira,
  Input,
  Modal,
  PrintView,
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
  const [exporting, setExporting] = useState<false | "csv" | "excel">(false);
  const [printRecords, setPrintRecords] = useState<Pensioner[] | null>(null);
  const [printSingle, setPrintSingle] = useState(false);

  const isAdmin = user?.role === "admin";
  const canVerify = isAdmin || user?.role === "clerk";
  const canExport = user?.role === "admin" || user?.role === "verifier" || user?.role === "clerk";

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

  async function handleExport(type: "csv" | "excel") {
    if (!token) return;
    setExporting(type);
    try {
      const scope = status.toLowerCase() as "verified" | "unverified" | "rejected";
      const result =
        type === "csv"
          ? await api.exportCsv(token, { scope }, "")
          : await api.exportExcel(token, { scope }, "");
      addToast({
        type: "success",
        title: "Export Ready",
        message: `${result.filename} (${result.record_count} records) saved to ${result.path}`,
      });
    } catch (err) {
      addToast({
        type: "error",
        title: "Export Failed",
        message: err instanceof Error ? err.message : "Could not export records",
      });
    } finally {
      setExporting(false);
    }
  }

  function printWithoutBrowserHeader() {
    // Chromium's print pipeline injects its own date/title header above the
    // page content, sourced from document.title. Blank it out for the print
    // job only, since the page's own PrintView already renders a proper title.
    const previousTitle = document.title;
    document.title = "";
    const restore = () => {
      document.title = previousTitle;
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    window.print();
    restore();
  }

  function handlePrintPage() {
    if (data.length === 0) {
      addToast({ type: "warning", title: "Nothing to print", message: "There are no records on this page." });
      return;
    }
    setPrintRecords(data);
    setPrintSingle(false);
    setTimeout(printWithoutBrowserHeader, 500);
  }

  function handlePrintRecord(record: Pensioner) {
    setPrintRecords([record]);
    setPrintSingle(true);
    setTimeout(printWithoutBrowserHeader, 500);
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
          <Button
            size="sm"
            variant="outline"
            className="px-2 py-1 text-xs"
            onClick={() => handlePrintRecord(row)}
          >
            Print
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
    <>
      <div className="print:hidden">
        <div className="mx-auto max-w-[1280px]">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
              <p className="mt-1 text-sm text-oagf-grey">Manage pensioner records and verification status</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {canExport && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleExport("csv")}
                    isLoading={exporting === "csv"}
                    disabled={!!exporting}
                  >
                    <FileText size={16} className="mr-1.5" />
                    Export CSV
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleExport("excel")}
                    isLoading={exporting === "excel"}
                    disabled={!!exporting}
                  >
                    <FileSpreadsheet size={16} className="mr-1.5" />
                    Export Excel
                  </Button>
                  <Button size="sm" variant="outline" onClick={handlePrintPage}>
                    <Printer size={16} className="mr-1.5" />
                    Print
                  </Button>
                </>
              )}
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
      </div>

      {printRecords && (
        <div className="fixed inset-0 z-50 hidden bg-white print:block">
          <PrintView records={printRecords} title={title} singleRecord={printSingle} />
        </div>
      )}
    </>
  );
}
