import { redirect } from "next/navigation";

/** Módulo Agenda desativado — redireciona para o dashboard. */
export default function AgendaPage() {
  redirect("/dashboard");
}
