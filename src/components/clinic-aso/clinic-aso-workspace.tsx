"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Download, FileUp, Search, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  createClinicAttendanceAction,
  lookupClinicEmployeeAction,
  archiveClinicAttendanceAction,
  emailClinicAttendanceAction,
} from "@/actions/clinic-aso";
import {
  CLINIC_ATTENDANCE_TYPES,
  CLINIC_LIFESTYLE,
  CLINIC_SEX,
  CLINIC_YES_NO,
  type ClinicAttendanceType,
  type ClinicAsoFormFields,
} from "@/lib/clinic-aso/types";

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

export function ClinicAsoWorkspace({
  physicians,
  attendances,
  integrations,
}: Props) {
  const [form, setForm] = useState(emptyForm);
  const [ocrInfo, setOcrInfo] = useState<string | null>(null);
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
    setOcrInfo(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/atendimento-aso/extract", {
      method: "POST",
      body: fd,
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Falha no upload/OCR");
      return;
    }
    const fields = data.fields as ClinicAsoFormFields;
    setForm((f) => ({
      ...f,
      asoFileName: data.asoFileName,
      asoFileHash: data.asoFileHash,
      asoBlobUrl: data.asoBlobUrl,
      extractionRaw: data.extraction,
      employeeName: fields.employeeName || f.employeeName,
      cpf: fields.cpf || f.cpf,
      matricula:
        f.attendanceType === "Admissional"
          ? "00000"
          : fields.matricula || f.matricula,
      attendanceType:
        (fields.attendanceType as ClinicAttendanceType) || f.attendanceType,
      situation: fields.situation || f.situation,
      date: fields.date || f.date,
      physicianCode: fields.physicianCode || f.physicianCode,
      sex: fields.sex || f.sex,
      weight: fields.weight || f.weight,
      height: fields.height || f.height,
      department: fields.department || f.department,
      jobTitle: fields.jobTitle || f.jobTitle,
      city: fields.city || f.city,
      birthDate: fields.birthDate || f.birthDate,
      conduct: fields.conduct || f.conduct,
      notes: fields.notes || f.notes,
      profile: fields.profile || f.profile,
      physicalActivity: fields.physicalActivity || f.physicalActivity,
      lifestyle: fields.lifestyle || f.lifestyle,
      sus: fields.sus || f.sus,
    }));
    setOcrInfo(
      data.duplicate
        ? "Atenção: este PDF já foi cadastrado (duplicidade)."
        : `ASO lido (${data.pageCount || 1} pág.). Revise e confirme na aba Cadastro.`,
    );
    toast.success("PDF processado.");
  }

  async function lookup() {
    if (form.attendanceType === "Admissional") return;
    const res = await lookupClinicEmployeeAction(form.matricula);
    if ("error" in res && res.error) {
      toast.error(res.error);
      return;
    }
    if (!("employee" in res) || !res.employee) return;
    const e = res.employee;
    setForm((f) => ({
      ...f,
      employeeName: e.fullName,
      department: e.department,
      jobTitle: e.jobTitle,
      cpf: e.cpf,
      city: e.city,
      birthDate: e.birthDate || "",
      sex: e.sex === "Feminino" || e.sex === "Masculino" ? e.sex : f.sex,
    }));
    toast.success("Colaborador carregado do Alterdata.");
  }

  function onSubmit() {
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
      toast.success("Atendimento salvo.");
      setForm(emptyForm);
      setOcrInfo(null);
      window.location.reload();
    });
  }

  return (
    <Tabs defaultValue="leitura">
      <TabsList variant="line" className="mb-4">
        <TabsTrigger value="leitura">
          <FileUp className="size-4" />
          Leitura / Importação ASO
        </TabsTrigger>
        <TabsTrigger value="cadastro">
          <Stethoscope className="size-4" />
          Cadastro e planilha
        </TabsTrigger>
      </TabsList>

      <TabsContent value="leitura" className="space-y-4">
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Envie o PDF do ASO. O sistema lê as páginas, extrai o que encontrar
            (sem inventar) e prepara o preenchimento. Colaboradores vêm do
            Alterdata já sincronizado — sem importar planilha nova.
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-muted px-2 py-1">
              OCR: {integrations.ocr ? integrations.ocrProvider : "texto do PDF"}
            </span>
            <span className="rounded-full bg-muted px-2 py-1">
              Drive: {integrations.drive ? "OK" : "pendente"}
            </span>
            <span className="rounded-full bg-muted px-2 py-1">
              SMTP: {integrations.smtp ? "OK" : "pendente"}
            </span>
          </div>
          <Label htmlFor="aso-file">Arquivo ASO (PDF)</Label>
          <Input
            id="aso-file"
            type="file"
            accept="application/pdf,image/*"
            onChange={(e) => onUpload(e.target.files?.[0] || null)}
          />
          {ocrInfo ? (
            <p className="text-sm text-emerald-700 dark:text-emerald-400">
              {ocrInfo}
            </p>
          ) : null}
          {form.asoBlobUrl ? (
            <a
              className="text-sm underline"
              href={form.asoBlobUrl}
              target="_blank"
              rel="noreferrer"
            >
              Ver PDF enviado
            </a>
          ) : null}
        </div>
      </TabsContent>

      <TabsContent value="cadastro" className="space-y-4">
        <div className="flex flex-wrap gap-2 justify-between">
          <p className="text-sm text-muted-foreground max-w-2xl">
            Confirme os dados e salve. Depois exporte a Agenda Médica 2026,
            arquive no Drive ou envie e-mail com o PDF anexo.
          </p>
          <a href="/api/atendimento-aso/export">
            <Button type="button" variant="outline" size="sm">
              <Download className="size-4" />
              Exportar Agenda Médica
            </Button>
          </a>
        </div>

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
              />
              <Button
                type="button"
                variant="outline"
                disabled={form.attendanceType === "Admissional"}
                onClick={lookup}
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

          <div className="md:col-span-2">
            <Button type="button" disabled={pending} onClick={onSubmit}>
              {pending ? "Salvando..." : "Salvar atendimento"}
            </Button>
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
                        {!r.driveUrl ? (
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
                        ) : (
                          <a
                            href={r.driveUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Button size="sm" variant="ghost" type="button">
                              Drive OK
                            </Button>
                          </a>
                        )}
                        {r.emailStatus !== "SENT" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            type="button"
                            onClick={() =>
                              startTransition(async () => {
                                const res = await emailClinicAttendanceAction(
                                  r.id,
                                );
                                if (res.error) toast.error(res.error);
                                else {
                                  toast.success("E-mail enviado.");
                                  window.location.reload();
                                }
                              })
                            }
                          >
                            E-mail
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground px-2 py-1">
                            E-mail OK
                          </span>
                        )}
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
