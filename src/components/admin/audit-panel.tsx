import { StatusBadge } from "@/components/feedback/status-badge";
import { formatDateTimeBR } from "@/lib/dates";
import type { AuditLogRow, LoginAttemptRow } from "@/db/queries/admin";

function actionTone(action: string): "ok" | "warn" | "danger" | "muted" | "info" {
  if (action.includes("DELETE") || action.includes("DEACTIVATE")) return "danger";
  if (action.includes("CREATE") || action.includes("ACTIVATE") || action === "LOGIN")
    return "ok";
  if (action.includes("SYNC") || action.includes("EXPORT")) return "info";
  if (action.includes("UPDATE") || action.includes("RESET")) return "warn";
  return "muted";
}

export function AdminAuditPanel({
  logs,
  loginAttempts,
}: {
  logs: AuditLogRow[];
  loginAttempts: LoginAttemptRow[];
}) {
  return (
    <div className="space-y-5">
      <section className="app-surface overflow-hidden">
        <div className="border-b border-border-subtle px-5 py-3.5">
          <h3 className="text-[14px] font-semibold text-slate-900">
            Trilha de auditoria
          </h3>
          <p className="mt-0.5 text-[12px] text-slate-500">
            Últimos eventos registrados no sistema (ações sensíveis e
            operacionais).
          </p>
        </div>
        {!logs.length ? (
          <p className="px-5 py-10 text-center text-[13px] text-slate-500">
            Nenhum evento de auditoria ainda.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="app-data-table">
              <thead>
                <tr>
                  <th className="text-left">Quando</th>
                  <th className="text-left">Quem</th>
                  <th className="text-center">Ação</th>
                  <th className="text-left">Entidade</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="whitespace-nowrap tabular-nums text-slate-500">
                      {log.createdAt ? formatDateTimeBR(log.createdAt) : "—"}
                    </td>
                    <td>
                      <div className="min-w-0">
                        <p className="app-table-emphasis truncate">
                          {log.userName ?? "Sistema"}
                        </p>
                        {log.userEmail ? (
                          <p className="app-table-meta truncate">
                            {log.userEmail}
                          </p>
                        ) : null}
                      </div>
                    </td>
                    <td className="text-center">
                      <StatusBadge
                        label={log.action}
                        tone={actionTone(log.action)}
                      />
                    </td>
                    <td>
                      <span className="font-medium text-slate-700">
                        {log.entityType}
                      </span>
                      {log.entityId ? (
                        <span className="ml-1.5 font-mono text-[10.5px] text-slate-400">
                          {log.entityId.slice(0, 8)}…
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="app-surface overflow-hidden">
        <div className="border-b border-border-subtle px-5 py-3.5">
          <h3 className="text-[14px] font-semibold text-slate-900">
            Tentativas de login
          </h3>
          <p className="mt-0.5 text-[12px] text-slate-500">
            Sucessos e falhas recentes — útil para detectar abuso de acesso.
          </p>
        </div>
        {!loginAttempts.length ? (
          <p className="px-5 py-8 text-center text-[13px] text-slate-500">
            Sem tentativas registradas.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="app-data-table">
              <thead>
                <tr>
                  <th className="text-left">Quando</th>
                  <th className="text-left">E-mail</th>
                  <th className="text-center">Resultado</th>
                  <th className="text-left">Detalhe</th>
                </tr>
              </thead>
              <tbody>
                {loginAttempts.map((a) => (
                  <tr key={a.id}>
                    <td className="whitespace-nowrap tabular-nums text-slate-500">
                      {a.createdAt ? formatDateTimeBR(a.createdAt) : "—"}
                    </td>
                    <td className="font-medium text-slate-800">{a.email}</td>
                    <td className="text-center">
                      <StatusBadge
                        label={a.success ? "OK" : "Falha"}
                        tone={a.success ? "ok" : "danger"}
                      />
                    </td>
                    <td className="text-slate-500">
                      {a.reason ?? (a.ipAddress ? `IP ${a.ipAddress}` : "—")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
