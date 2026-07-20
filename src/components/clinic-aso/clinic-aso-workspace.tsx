"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Download,
  FileUp,
  Loader2,
  Search,
  Stethoscope,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  createClinicAttendanceAction,
  lookupClinicEmployeeAction,
  archiveClinicAttendanceAction,
} from "@/actions/clinic-aso";
import {
  CLINIC_ATTENDANCE_TYPES,
  CLINIC_LIFESTYLE,
  CLINIC_SEX,
  CLINIC_YES_NO,
  type ClinicAttendanceType,
  type ClinicAsoFormFields,
} from "@/lib/clinic-aso/types";
import { cn } from "@/lib/utils";

type Physician = { id: string; code: string | null; name: string };
type AttendanceRow = {
  id: string;
  attendanceDate: string;
  registration: string;
  employeeName: string;
  attendanceType: string;
  situation: string;
  physicianName: string;
  driveUrl: string | null;
  emailStatus: string;
  asoBlobUrl: string | null;
};

type EmployeeHit = {
  id: string;
  registration: string;
  fullName: string;
  cpf: string;
  department: string;
  jobTitle: string;
  city: string;
  birthDate: string | null;
  sex: string | null;
};

type Props = {
  physicians: Physician[];
  attendances: AttendanceRow[];
  integrations: {
    drive: boolean;
    smtp: boolean;
    ocr: boolean;
    ocrProvider: string;
  };
};

const emptyForm = {
  date: new Date().toISOString().slice(0, 10),
  matricula: "",
  attendanceType: "Periódico" as ClinicAttendanceType,
  situation: "Apto",
  conduct: "",
  physicianCode: "",
  notes: "",
  physicalActivity: "Não",
  lifestyle: "Nem Bebe e Nem Fuma",
  sex: "Masculino",
  weight: "",
  height: "",
  profile: "",
  employeeName: "",
  department: "",
  jobTitle: "",
  cpf: "",
  sus: "",
  city: "",
  birthDate: "",
  asoFileName: null as string | null,
  asoFileHash: null as string | null,
  asoBlobUrl: null as string | null,
  extractionRaw: null as unknown,
};

const selectClass =
  "border-input h-8 w-full rounded-lg border bg-transparent px-2.5 text-sm outline-none";

function applyEmployee(
  f: typeof emptyForm,
  e: EmployeeHit,
): typeof emptyForm {
  return {
    ...f,
    matricula: e.registration || f.matricula,
    employeeName: e.fullName,
    department: e.department,
    jobTitle: e.jobTitle,
    cpf: e.cpf || f.cpf,
    city: e.city || f.city,
    birthDate: e.birthDate || f.birthDate,
    sex:
      e.sex === "Feminino" || e.sex === "Masculino" ? e.sex : f.sex,
  };
}

export function ClinicAsoWorkspace({
  physicians,
  attendances,
  integrations,
}: Props) {
  const [tab, setTab] = useState("leitura");
  const [form, setForm] = useState(emptyForm);
  const [ocrInfo, setOcrInfo] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [alterdataOk, setAlterdataOk] = useState(false);
  const [lastSavedId, setLastSavedId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  const situationOptions = useMemo(() => {
    if (form.attendanceType === "Consulta") return ["Realizada"];
    return ["Apto", "Inapto"];
  }, [form.attendanceType]);

  function setField<K extends keyof typeof emptyForm>(
    key: K,
    value: (typeof emptyForm)[K],
  ) {
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (key === "attendanceType") {
        const t = value as ClinicAttendanceType;
        if (t === "Admissional") next.matricula = "00000";
        if (t === "Consulta") next.situation = "Realizada";
        else if (next.situation === "Realizada") next.situation = "Apto";
      }
      return next;
    });
  }

  async function onUpload(file: File | null) {
    if (!file) return;
    setReading(true);
    setOcrInfo(null);
    setWarning(null);
    setAlterdataOk(false);
    setLastSavedId(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/atendimento-aso/extract", {
        method: "POST",
        body: fd,
        credentials: "same-origin",
      });

      const raw = await res.text();
      let data: Record<string, unknown> = {};
      try {
        data = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      } catch {
        toast.error(
          res.status === 401 || res.redirected
            ? "Sessão expirada. Atualize a página e entre de novo."
            : `Falha no servidor (${res.status}). Tente outro PDF ou recarregue.`,
        );
        return;
      }

      if (!res.ok) {
        toast.error(
          typeof data.error === "string"
            ? data.error
            : `Falha ao ler o ASO (${res.status})`,
        );
        return;
      }

      const fields = (data.fields ?? {}) as ClinicAsoFormFields;
      let next: typeof emptyForm = {
        ...emptyForm,
        asoFileName: (data.asoFileName as string) || file.name,
        asoFileHash: (data.asoFileHash as string) || "",
        asoBlobUrl: (data.asoBlobUrl as string) || null,
        extractionRaw: data.extraction,
        employeeName: fields.employeeName || "",
        cpf: fields.cpf || "",
        matricula:
          fields.attendanceType === "Admissional"
            ? "00000"
            : fields.matricula || "",
        attendanceType:
          (fields.attendanceType as ClinicAttendanceType) || "Periódico",
        situation: fields.situation || "Apto",
        date: fields.date || emptyForm.date,
        physicianCode: fields.physicianCode || "",
        sex: (fields.sex as typeof emptyForm.sex) || "Masculino",
        weight: fields.weight || "",
        height: fields.height || "",
        department: fields.department || "",
        jobTitle: fields.jobTitle || "",
        city: fields.city || "",
        birthDate: fields.birthDate || "",
        conduct: fields.conduct || "",
        notes: fields.notes || "",
        profile: fields.profile || "",
        physicalActivity:
          (fields.physicalActivity as typeof emptyForm.physicalActivity) ||
          "Não",
        lifestyle:
          (fields.lifestyle as typeof emptyForm.lifestyle) ||
          "Nem Bebe e Nem Fuma",
        sus: fields.sus || "",
      };

      if (data.employee) {
        next = applyEmployee(next, data.employee as EmployeeHit);
        setAlterdataOk(true);
      }

      if (!next.physicianCode && physicians.length === 1) {
        next.physicianCode = physicians[0].code || "";
      }

      setForm(next);

      if (data.duplicate) {
        setWarning("Este PDF já foi cadastrado antes (duplicidade).");
      } else if (data.ocrError) {
        setWarning(
          `Leitura parcial: ${String(data.ocrError)}. Digite a matrícula e busque no Alterdata.`,
        );
      } else if (data.storageEphemeral) {
        setWarning(
          "Arquivo salvo só temporariamente na nuvem. Configure BLOB_READ_WRITE_TOKEN (ou Google Drive) no Vercel para guardar o PDF de forma definitiva.",
        );
      } else if (data.lowText) {
        setWarning(
          "Pouco texto no PDF (pode ser scan só de imagem). Se a matrícula não veio, digite e clique em Buscar Alterdata — o resto do colaborador preenche sozinho.",
        );
      }

      setOcrInfo(
        data.employee
          ? `ASO lido (${(data.pageCount as number) || 1} pág.) + colaborador do Alterdata preenchido.`
          : `ASO lido (${(data.pageCount as number) || 1} pág.). Confirme matrícula e médico, depois salve.`,
      );
      setTab("cadastro");
      toast.success(
        data.employee
          ? "ASO lido e Alterdata preenchido."
          : "ASO processado — revise o cadastro.",
      );
    } catch (e) {
      console.error("[clinic-aso] upload", e);
      toast.error(
        e instanceof Error
          ? e.message
          : "Erro ao processar o arquivo. Verifique a conexão e tente de novo.",
      );
    } finally {
      setReading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function lookup() {
    if (form.attendanceType === "Admissional") return;
    const res = await lookupClinicEmployeeAction(form.matricula);
    if ("error" in res && res.error) {
      toast.error(res.error);
      setAlterdataOk(false);
      return;
    }
    if (!("employee" in res) || !res.employee) return;
    setForm((f) => applyEmployee(f, res.employee as EmployeeHit));
    setAlterdataOk(true);
    toast.success("Colaborador carregado do Alterdata.");
  }

  function onSubmit(andExport: boolean) {
    startTransition(async () => {
      const res = await createClinicAttendanceAction({
        ...form,
        weight: form.weight ? Number(form.weight) : null,
        height: form.height ? Number(form.height) : null,
        birthDate: form.birthDate || null,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      const id =
        res.record && typeof res.record === "object" && "id" in res.record
          ? String((res.record as { id: string }).id)
          : null;
      setLastSavedId(id);
      toast.success("Atendimento salvo na Agenda Médica.");
      setForm(emptyForm);
      setOcrInfo(null);
      setWarning(null);
      setAlterdataOk(false);
      if (andExport) {
        window.location.href = "/api/atendimento-aso/export";
        setTimeout(() => window.location.reload(), 800);
      } else {
        window.location.reload();
      }
    });
  }

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => setTab(String(v ?? "leitura"))}
    >
      <TabsList variant="line" className="mb-4">
        <TabsTrigger value="leitura">
          <FileUp className="size-4" />
          1. Ler ASO
        </TabsTrigger>
        <TabsTrigger value="cadastro">
          <Stethoscope className="size-4" />
          2. Confirmar e planilha
        </TabsTrigger>
      </TabsList>

      <TabsContent value="leitura" className="space-y-4">
        <div
          className={cn(
            "rounded-xl border-2 border-dashed bg-card p-8 text-center transition-colors",
            dragOver
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25",
            reading && "opacity-70 pointer-events-none",
          )}
          onDragEnter={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDragOver(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file) void onUpload(file);
          }}
        >
          {reading ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="size-10 animate-spin text-primary" />
              <p className="text-sm font-medium">Lendo ASO e buscando no Alterdata…</p>
              <p className="text-xs text-muted-foreground">
                Aguarde — o formulário será preenchido automaticamente.
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="rounded-full bg-primary/10 p-4 text-primary">
                <FileUp className="size-8" />
              </div>
              <div className="space-y-1">
                <p className="text-base font-medium">
                  Arraste o PDF do ASO escaneado aqui
                </p>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  O sistema lê o documento, busca o colaborador no Alterdata e
                  prepara a linha da Agenda Médica. Você só confere e salva.
                </p>
              </div>
              <Button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="mt-2"
              >
                Escolher arquivo
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                onChange={(e) => onUpload(e.target.files?.[0] || null)}
              />
              <p className="text-xs text-muted-foreground mt-2">
                Preferível PDF com texto (scan com OCR do equipamento). Leitura:{" "}
                {integrations.ocr
                  ? integrations.ocrProvider
                  : "texto embutido do PDF"}
                {integrations.drive ? " · Drive OK" : ""}
              </p>
            </div>
          )}
        </div>

        {ocrInfo ? (
          <p className="text-sm text-emerald-700 dark:text-emerald-400">
            {ocrInfo}
          </p>
        ) : null}
        {warning ? (
          <p className="text-sm text-amber-700 dark:text-amber-400">{warning}</p>
        ) : null}
      </TabsContent>

      <TabsContent value="cadastro" className="space-y-4">
        <div className="flex flex-wrap gap-2 justify-between items-start">
          <p className="text-sm text-muted-foreground max-w-2xl">
            Confira os dados preenchidos. Ao salvar, a linha entra na Agenda
            Médica — depois baixe a planilha completa.
          </p>
          <a href="/api/atendimento-aso/export">
            <Button type="button" variant="outline" size="sm">
              <Download className="size-4" />
              Baixar Agenda Médica
            </Button>
          </a>
        </div>

        {(ocrInfo || warning || alterdataOk) && (
          <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm space-y-1">
            {ocrInfo ? <p>{ocrInfo}</p> : null}
            {alterdataOk ? (
              <p className="text-emerald-700 dark:text-emerald-400">
                Dados cadastrais vindos do Alterdata.
              </p>
            ) : null}
            {warning ? (
              <p className="text-amber-700 dark:text-amber-400">{warning}</p>
            ) : null}
            {form.asoBlobUrl ? (
              <a
                className="underline text-xs"
                href={form.asoBlobUrl}
                target="_blank"
                rel="noreferrer"
              >
                Ver PDF enviado
              </a>
            ) : null}
          </div>
        )}

        {lastSavedId ? (
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm flex flex-wrap gap-2 items-center justify-between">
            <span>Último atendimento salvo.</span>
            <a href="/api/atendimento-aso/export">
              <Button size="sm" type="button">
                <Download className="size-4" />
                Baixar planilha agora
              </Button>
            </a>
          </div>
        ) : null}

        <div className="rounded-xl border bg-card p-4 grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <select
              className={selectClass}
              value={form.attendanceType}
              onChange={(e) =>
                setField(
                  "attendanceType",
                  e.target.value as ClinicAttendanceType,
                )
              }
            >
              {CLINIC_ATTENDANCE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>Situação</Label>
            <select
              className={selectClass}
              value={form.situation}
              onChange={(e) => setField("situation", e.target.value)}
            >
              {situationOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>Data</Label>
            <Input
              type="date"
              value={form.date}
              onChange={(e) => setField("date", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Matrícula</Label>
            <div className="flex gap-2">
              <Input
                value={form.matricula}
                disabled={form.attendanceType === "Admissional"}
                onChange={(e) => setField("matricula", e.target.value)}
                placeholder="Lida do ASO ou digite"
              />
              <Button
                type="button"
                variant="outline"
                disabled={form.attendanceType === "Admissional"}
                onClick={lookup}
                title="Buscar no Alterdata"
              >
                <Search className="size-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label>Colaborador</Label>
            <Input
              value={form.employeeName}
              disabled={form.attendanceType !== "Admissional"}
              onChange={(e) =>
                setField("employeeName", e.target.value.toUpperCase())
              }
            />
          </div>

          <div className="space-y-1.5">
            <Label>Unidade / Departamento</Label>
            <Input
              value={form.department}
              disabled={form.attendanceType !== "Admissional"}
              onChange={(e) => setField("department", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Função</Label>
            <Input
              value={form.jobTitle}
              disabled={form.attendanceType !== "Admissional"}
              onChange={(e) => setField("jobTitle", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Médico</Label>
            <select
              className={selectClass}
              value={form.physicianCode}
              onChange={(e) => setField("physicianCode", e.target.value)}
            >
              <option value="">Selecione</option>
              {physicians.map((p) => (
                <option key={p.id} value={p.code || ""}>
                  {p.code ? `${p.code} — ` : ""}
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>Sexo</Label>
            <select
              className={selectClass}
              value={form.sex}
              onChange={(e) => setField("sex", e.target.value)}
            >
              {CLINIC_SEX.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>Atividade física</Label>
            <select
              className={selectClass}
              value={form.physicalActivity}
              onChange={(e) => setField("physicalActivity", e.target.value)}
            >
              {CLINIC_YES_NO.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>Hábitos</Label>
            <select
              className={selectClass}
              value={form.lifestyle}
              onChange={(e) => setField("lifestyle", e.target.value)}
            >
              {CLINIC_LIFESTYLE.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>Peso (kg)</Label>
            <Input
              type="number"
              step="0.1"
              value={form.weight}
              onChange={(e) => setField("weight", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Altura (cm)</Label>
            <Input
              type="number"
              step="0.1"
              value={form.height}
              onChange={(e) => setField("height", e.target.value)}
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label>Conduta</Label>
            <Textarea
              value={form.conduct}
              onChange={(e) => setField("conduct", e.target.value)}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Observações</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
            />
          </div>

          <div className="md:col-span-2 flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={pending || !form.asoFileHash}
              onClick={() => onSubmit(true)}
            >
              {pending ? "Salvando..." : "Salvar e baixar planilha"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending || !form.asoFileHash}
              onClick={() => onSubmit(false)}
            >
              Só salvar
            </Button>
            {!form.asoFileHash ? (
              <p className="text-xs text-muted-foreground self-center">
                Envie o ASO na aba 1 antes de salvar.
              </p>
            ) : null}
          </div>
        </div>

        <div className="rounded-xl border bg-card overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="p-3">Data</th>
                <th className="p-3">Matrícula</th>
                <th className="p-3">Colaborador</th>
                <th className="p-3">Tipo</th>
                <th className="p-3">Situação</th>
                <th className="p-3">Médico</th>
                <th className="p-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {attendances.length === 0 ? (
                <tr>
                  <td className="p-4 text-muted-foreground" colSpan={7}>
                    Nenhum atendimento clínico cadastrado ainda.
                  </td>
                </tr>
              ) : (
                attendances.map((r) => (
                  <tr key={r.id} className="border-b">
                    <td className="p-3">{r.attendanceDate}</td>
                    <td className="p-3">{r.registration}</td>
                    <td className="p-3">{r.employeeName}</td>
                    <td className="p-3">{r.attendanceType}</td>
                    <td className="p-3">{r.situation}</td>
                    <td className="p-3">{r.physicianName}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {r.asoBlobUrl ? (
                          <a
                            href={r.asoBlobUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Button size="sm" variant="ghost" type="button">
                              PDF
                            </Button>
                          </a>
                        ) : null}
                        {integrations.drive && !r.driveUrl ? (
                          <Button
                            size="sm"
                            variant="outline"
                            type="button"
                            onClick={() =>
                              startTransition(async () => {
                                const res =
                                  await archiveClinicAttendanceAction(r.id);
                                if (res.error) toast.error(res.error);
                                else {
                                  toast.success("Arquivado no Drive.");
                                  window.location.reload();
                                }
                              })
                            }
                          >
                            Drive
                          </Button>
                        ) : r.driveUrl ? (
                          <a
                            href={r.driveUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Button size="sm" variant="ghost" type="button">
                              Drive OK
                            </Button>
                          </a>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </TabsContent>
    </Tabs>
  );
}
