import { createAsync } from "@solidjs/router"
import { Show, type ParentProps } from "solid-js"
import { AdminShell } from "~/components/admin-shell"
import { requirePlatformMe } from "~/lib/actions"

export default function PlatformAdminLayout(props: ParentProps) {
  const admin = createAsync(() => requirePlatformMe())
  return (
    <Show when={admin()}>
      {(current) => <AdminShell user={current()}>{props.children}</AdminShell>}
    </Show>
  )
}
