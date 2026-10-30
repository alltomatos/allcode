import { createAsync } from "@solidjs/router"
import { Show, type ParentProps } from "solid-js"
import { Shell } from "~/components/shell"
import { requireMe } from "~/lib/actions"

export default function AppLayout(props: ParentProps) {
  const user = createAsync(() => requireMe())
  return (
    <Show when={user()}>
      {(current) => <Shell user={current()}>{props.children}</Shell>}
    </Show>
  )
}
