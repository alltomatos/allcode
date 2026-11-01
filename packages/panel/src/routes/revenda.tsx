import { createAsync } from "@solidjs/router"
import { Show, type ParentProps } from "solid-js"
import { ResellerShell } from "~/components/reseller-shell"
import { requireResellerMe } from "~/lib/actions"

export default function ResellerLayout(props: ParentProps) {
  const me = createAsync(() => requireResellerMe())
  return (
    <Show when={me()}>
      {(current) => (
        <ResellerShell
          user={current().user}
          resellerName={current().reseller?.name}
          commissionRate={current().reseller?.commissionRate}
        >
          {props.children}
        </ResellerShell>
      )}
    </Show>
  )
}
