import { useEffect, useMemo, useState } from "react";
import { Camera, TrendingUp, Wallet, PiggyBank } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import {
  api,
  Button,
  Card,
  CardContent,
  DateInput,
  formatDateForInput,
  formatNaira,
  Input,
  SectionHeader,
  Select,
  useAuthStore,
  useUIStore,
  BANKS,
  GENDERS,
  ZONES,
  calculateFinancials,
  isValidAccountNumber,
} from "@oagf/ui";
import type { Pensioner } from "@oagf/ui";
import { CameraModal } from "../components/CameraModal";

type FormState = {
  full_name: string;
  gender: string;
  date_of_birth: string;
  location: string;
  zone: string;
  photo_path: string;
  salary_structure: string;
  mda_name: string;
  grade: string;
  step: string;
  first_appointment_date: string;
  last_promotion_date: string;
  retirement_date: string;
  years_of_service: string;
  months_of_service: string;
  apa: string;
  gratuity: string;
  pension: string;
  repatriation: string;
  total_employee_contribution_due: string;
  amount_owed: string;
  amount_paid_by_oagf: string;
  bank_name: string;
  custom_bank_name: string;
  account_number: string;
  bank_address: string;
  nok_name: string;
  nok_phone: string;
  nok_relation: string;
  nok_payment: boolean;
};

const emptyForm: FormState = {
  full_name: "",
  gender: "",
  date_of_birth: "",
  location: "",
  zone: "",
  photo_path: "",
  salary_structure: "",
  mda_name: "",
  grade: "",
  step: "",
  first_appointment_date: "",
  last_promotion_date: "",
  retirement_date: "",
  years_of_service: "",
  months_of_service: "",
  apa: "",
  gratuity: "",
  pension: "",
  repatriation: "",
  total_employee_contribution_due: "",
  amount_owed: "",
  amount_paid_by_oagf: "",
  bank_name: "",
  custom_bank_name: "",
  account_number: "",
  bank_address: "",
  nok_name: "",
  nok_phone: "",
  nok_relation: "",
  nok_payment: false,
};

export function EvaluationPage() {
  const { token, user } = useAuthStore();
  const addToast = useUIStore((state) => state.addToast);
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();

  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);

  const financial = useMemo(
    () =>
      calculateFinancials({
        apa: form.apa,
        gratuity: form.gratuity,
        pension: form.pension,
        repatriation: form.repatriation,
        total_employee_contribution_due: form.total_employee_contribution_due,
        amount_owed: form.amount_owed,
        amount_paid_by_oagf: form.amount_paid_by_oagf,
      }),
    [form],
  );

  useEffect(() => {
    if (id && token) {
      api
        .getPensioner(token, id)
        .then((p) => setForm(pensionerToForm(p)))
        .catch((err) => addToast({ type: "error", title: "Error", message: err.message }));
    }
  }, [id, token, addToast]);

  function pensionerToForm(p: Pensioner): FormState {
    return {
      full_name: p.full_name,
      gender: p.gender ?? "",
      date_of_birth: formatDateForInput(p.date_of_birth),
      location: p.location ?? "",
      zone: p.zone ?? "",
      photo_path: p.photo_path ?? "",
      salary_structure: p.salary_structure ?? "",
      mda_name: p.mda_name ?? "",
      grade: p.grade ?? "",
      step: p.step ?? "",
      first_appointment_date: formatDateForInput(p.first_appointment_date),
      last_promotion_date: formatDateForInput(p.last_promotion_date),
      retirement_date: formatDateForInput(p.retirement_date),
      years_of_service: p.years_of_service?.toString() ?? "",
      months_of_service: p.months_of_service?.toString() ?? "",
      apa: p.apa?.toString() ?? "",
      gratuity: p.gratuity?.toString() ?? "",
      pension: p.pension?.toString() ?? "",
      repatriation: p.repatriation?.toString() ?? "",
      total_employee_contribution_due: p.total_employee_contribution_due?.toString() ?? "",
      amount_owed: p.amount_owed?.toString() ?? "",
      amount_paid_by_oagf: p.amount_paid_by_oagf?.toString() ?? "",
      bank_name: p.bank_name ?? "",
      custom_bank_name: "",
      account_number: p.account_number ?? "",
      bank_address: p.bank_address ?? "",
      nok_name: p.nok_name ?? "",
      nok_phone: p.nok_phone ?? "",
      nok_relation: p.nok_relation ?? "",
      nok_payment: p.nok_payment ?? false,
    };
  }

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  function validate(): boolean {
    const nextErrors: Partial<Record<keyof FormState, string>> = {};
    if (!form.full_name.trim()) nextErrors.full_name = "Full name is required";
    if (form.account_number && !isValidAccountNumber(form.account_number)) {
      nextErrors.account_number = "Account number must be 10 digits";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate() || !token || !user) return;

    setIsSubmitting(true);
    try {
      const payload: Omit<Pensioner, "id" | "created_at" | "updated_at"> = {
        full_name: form.full_name,
        gender: (form.gender as Pensioner["gender"]) || undefined,
        date_of_birth: form.date_of_birth || undefined,
        location: form.location || undefined,
        zone: form.zone || undefined,
        photo_path: form.photo_path || undefined,
        salary_structure: form.salary_structure || undefined,
        mda_name: form.mda_name || undefined,
        grade: form.grade || undefined,
        step: form.step || undefined,
        first_appointment_date: form.first_appointment_date || undefined,
        last_promotion_date: form.last_promotion_date || undefined,
        retirement_date: form.retirement_date || undefined,
        years_of_service: form.years_of_service ? parseInt(form.years_of_service, 10) : undefined,
        months_of_service: form.months_of_service ? parseInt(form.months_of_service, 10) : undefined,
        apa: parseFloat(form.apa) || 0,
        gratuity: parseFloat(form.gratuity) || 0,
        pension: parseFloat(form.pension) || 0,
        repatriation: parseFloat(form.repatriation) || 0,
        total_employee_contribution_due: parseFloat(form.total_employee_contribution_due) || 0,
        amount_owed: financial.amountOwed,
        amount_owed_to_mda: 0,
        amount_paid_by_oagf: parseFloat(form.amount_paid_by_oagf) || 0,
        ten_percent_gratuity: financial.tenPercentGratuity,
        ten_percent_pension: financial.tenPercentPension,
        due_for_payment_by_oagf: financial.dueForPayment,
        bank_name:
          form.bank_name === "Other" && form.custom_bank_name.trim()
            ? form.custom_bank_name.trim()
            : form.bank_name || undefined,
        account_number: form.account_number || undefined,
        bank_address: form.bank_address || undefined,
        nok_name: form.nok_name || undefined,
        nok_phone: form.nok_phone || undefined,
        nok_relation: form.nok_relation || undefined,
        nok_payment: form.nok_payment,
        status: "Unverified",
        verification_notes: undefined,
        created_by: user.id,
        updated_by: user.id,
      };

      if (id) {
        await api.updatePensioner(token, id, payload);
        addToast({ type: "success", title: "Updated", message: "Record updated successfully." });
      } else {
        await api.createPensioner(token, payload);
        addToast({ type: "success", title: "Saved", message: "Record submitted successfully." });
        setForm(emptyForm);
      }
      navigate("/unverified");
    } catch (err) {
      addToast({
        type: "error",
        title: "Error",
        message: err instanceof Error ? err.message : "Failed to save record",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleCapture(dataUrl: string) {
    setForm((prev) => ({ ...prev, photo_path: dataUrl }));
  }

  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">{id ? "Edit Record" : "Evaluation Form"}</h2>
        <p className="mt-1 text-sm text-oagf-grey">Capture beneficiary details for severance processing</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Section 1: Personal Information */}
        <Card accent>
          <CardContent>
            <SectionHeader number={1} title="Personal Information" />
            <div className="grid gap-6 lg:grid-cols-4">
              <div className="lg:col-span-3">
                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                  <Input
                    label="Full Name"
                    value={form.full_name}
                    onChange={(e) => updateField("full_name", e.target.value)}
                    error={errors.full_name}
                    placeholder="Surname Firstname Middlename"
                    required
                  />
                  <Select
                    label="Gender"
                    value={form.gender}
                    onChange={(e) => updateField("gender", e.target.value)}
                    options={GENDERS.map((g) => ({ value: g, label: g }))}
                    placeholder="Select gender"
                  />
                  <DateInput
                    label="Date of Birth"
                    value={form.date_of_birth}
                    onChange={(e) => updateField("date_of_birth", e.target.value)}
                    hint="YYYY-MM-DD"
                  />
                  <Input
                    label="Location"
                    value={form.location}
                    onChange={(e) => updateField("location", e.target.value)}
                    placeholder="City / LGA"
                  />
                  <Select
                    label="Zone"
                    value={form.zone}
                    onChange={(e) => updateField("zone", e.target.value)}
                    options={ZONES.map((z) => ({ value: z, label: z }))}
                    placeholder="Select zone"
                  />
                </div>
              </div>

              <div className="flex flex-col items-center justify-start rounded-xl border border-gray-200 bg-gray-50 p-4">
                <label className="mb-2 block text-sm font-medium text-oagf-text">Passport Photograph</label>
                {form.photo_path ? (
                  <img
                    src={form.photo_path}
                    alt="Beneficiary"
                    className="mb-3 h-36 w-36 rounded-xl border border-gray-200 object-cover shadow-sm"
                  />
                ) : (
                  <div className="mb-3 flex h-36 w-36 flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-white text-center text-sm text-oagf-grey">
                    <Camera size={28} className="mb-2 text-gray-400" />
                    No photo
                  </div>
                )}
                <Button type="button" size="sm" variant="outline" onClick={() => setCameraOpen(true)}>
                  Capture / Upload
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Employment & Service Records */}
        <Card accent>
          <CardContent>
            <SectionHeader number={2} title="Employment & Service Records" />
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              <Input
                label="MDA Name"
                value={form.mda_name}
                onChange={(e) => updateField("mda_name", e.target.value)}
                placeholder="Ministry / Department / Agency"
              />
              <Input
                label="Salary Structure"
                value={form.salary_structure}
                onChange={(e) => updateField("salary_structure", e.target.value)}
                placeholder="e.g. CONMESS"
              />
              <Input
                label="Grade"
                value={form.grade}
                onChange={(e) => updateField("grade", e.target.value)}
                placeholder="e.g. 12"
              />
              <Input
                label="Step"
                value={form.step}
                onChange={(e) => updateField("step", e.target.value)}
                placeholder="e.g. 5"
              />
              <DateInput
                label="1st Appointment Date"
                value={form.first_appointment_date}
                onChange={(e) => updateField("first_appointment_date", e.target.value)}
                hint="YYYY-MM-DD"
              />
              <DateInput
                label="Last Promotion Date"
                value={form.last_promotion_date}
                onChange={(e) => updateField("last_promotion_date", e.target.value)}
                hint="YYYY-MM-DD"
              />
              <DateInput
                label="Retirement Date"
                value={form.retirement_date}
                onChange={(e) => updateField("retirement_date", e.target.value)}
                hint="YYYY-MM-DD"
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Years of Service"
                  type="number"
                  min="0"
                  value={form.years_of_service}
                  onChange={(e) => updateField("years_of_service", e.target.value)}
                />
                <Input
                  label="Months"
                  type="number"
                  min="0"
                  max="11"
                  value={form.months_of_service}
                  onChange={(e) => updateField("months_of_service", e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Financial & Payment Information */}
        <Card accent>
          <CardContent className="space-y-8">
            <SectionHeader number={3} title="Financial & Payment Information" />

            <div>
              <h4 className="mb-4 text-sm font-semibold text-gray-700">Inputs</h4>
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                <Input
                  label="APA (₦)"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.apa}
                  onChange={(e) => updateField("apa", e.target.value)}
                  placeholder="Annual Pensionable Allowance"
                />
                <Input
                  label="Gratuity (₦)"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.gratuity}
                  onChange={(e) => updateField("gratuity", e.target.value)}
                />
                <Input
                  label="Pension (₦)"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.pension}
                  onChange={(e) => updateField("pension", e.target.value)}
                />
                <Input
                  label="Repatriation (₦)"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.repatriation}
                  onChange={(e) => updateField("repatriation", e.target.value)}
                />
                <Input
                  label="Total Employee Contribution Due (₦)"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.total_employee_contribution_due}
                  onChange={(e) => updateField("total_employee_contribution_due", e.target.value)}
                />
                <Input
                  label="Amount Owed (₦)"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount_owed}
                  onChange={(e) => updateField("amount_owed", e.target.value)}
                  placeholder="Total amount owed by OAGF"
                />
                <Input
                  label="Amount Paid by OAGF (₦)"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount_paid_by_oagf}
                  onChange={(e) => updateField("amount_paid_by_oagf", e.target.value)}
                />
              </div>
            </div>

            <div>
              <h4 className="mb-4 text-sm font-semibold text-gray-700">Calculated Summary</h4>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-xl border border-green-100 bg-green-50 p-5">
                  <div className="mb-2 flex items-center gap-2 text-green-700">
                    <PiggyBank size={18} />
                    <span className="text-xs font-semibold uppercase tracking-wide">10% Gratuity</span>
                  </div>
                  <p className="text-2xl font-bold text-green-800">
                    {formatNaira(financial.tenPercentGratuity)}
                  </p>
                </div>
                <div className="rounded-xl border border-green-100 bg-green-50 p-5">
                  <div className="mb-2 flex items-center gap-2 text-green-700">
                    <Wallet size={18} />
                    <span className="text-xs font-semibold uppercase tracking-wide">10% Pension</span>
                  </div>
                  <p className="text-2xl font-bold text-green-800">
                    {formatNaira(financial.tenPercentPension)}
                  </p>
                </div>
                <div className="rounded-xl border border-blue-100 bg-blue-50 p-5">
                  <div className="mb-2 flex items-center gap-2 text-blue-700">
                    <TrendingUp size={18} />
                    <span className="text-xs font-semibold uppercase tracking-wide">Due for Payment</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-800">
                    {formatNaira(financial.dueForPayment)}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 4: Banking Information */}
        <Card accent>
          <CardContent>
            <SectionHeader number={4} title="Banking Information" />
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              <Select
                label="Bank Name"
                value={form.bank_name}
                onChange={(e) => updateField("bank_name", e.target.value)}
                options={BANKS.map((b) => ({ value: b, label: b }))}
                placeholder="Select bank"
              />
              {form.bank_name === "Other" && (
                <Input
                  label="Custom Bank Name"
                  value={form.custom_bank_name}
                  onChange={(e) => updateField("custom_bank_name", e.target.value)}
                  placeholder="Enter bank name"
                />
              )}
              <Input
                label="Account Number"
                type="text"
                maxLength={10}
                value={form.account_number}
                onChange={(e) => updateField("account_number", e.target.value)}
                error={errors.account_number}
                hint="10-digit NUBAN account number"
              />
              <div className="md:col-span-2 lg:col-span-3">
                <Input
                  label="Bank Address"
                  value={form.bank_address}
                  onChange={(e) => updateField("bank_address", e.target.value)}
                  placeholder="Branch address"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 5: Next of Kin & Verification */}
        <Card accent>
          <CardContent>
            <SectionHeader number={5} title="Next of Kin & Verification" />
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              <Input
                label="NOK Name"
                value={form.nok_name}
                onChange={(e) => updateField("nok_name", e.target.value)}
                placeholder="Full name of next of kin"
              />
              <Input
                label="NOK Phone"
                type="tel"
                value={form.nok_phone}
                onChange={(e) => updateField("nok_phone", e.target.value)}
                placeholder="080XXXXXXXX"
              />
              <Input
                label="NOK Relation"
                value={form.nok_relation}
                onChange={(e) => updateField("nok_relation", e.target.value)}
                placeholder="e.g. Spouse, Son, Daughter"
              />
              <div className="flex items-center md:col-span-2 lg:col-span-3">
                <input
                  id="nok_payment"
                  type="checkbox"
                  checked={form.nok_payment}
                  onChange={(e) => updateField("nok_payment", e.target.checked)}
                  className="h-4 w-4 rounded border-oagf-border text-oagf-green focus:ring-oagf-green"
                />
                <label htmlFor="nok_payment" className="ml-2 text-sm text-oagf-text">
                  Payment should go to Next of Kin
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-center pb-8">
          <Button type="submit" size="lg" isLoading={isSubmitting} className="min-w-[240px]">
            Submit Record
          </Button>
        </div>
      </form>

      <CameraModal isOpen={cameraOpen} onClose={() => setCameraOpen(false)} onCapture={handleCapture} />
    </div>
  );
}
