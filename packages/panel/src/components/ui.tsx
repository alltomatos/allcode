import { For, Show, type ComponentProps, type JSX } from "solid-js"

export function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ")
}

type Variant = "primary" | "secondary" | "danger" | "ghost"
type Size = "md" | "sm"

const variants: Record<Variant, string> = {
  primary:
    "bg-indigo-600 text-white hover:bg-indigo-500 focus-visible:outline-indigo-600 disabled:bg-indigo-300",
  secondary:
    "bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 focus-visible:outline-slate-400 disabled:text-slate-400",
  danger: "bg-rose-600 text-white hover:bg-rose-500 focus-visible:outline-rose-600 disabled:bg-rose-300",
  ghost: "text-slate-600 hover:bg-slate-100 focus-visible:outline-slate-400",
}

const sizes: Record<Size, string> = {
  md: "h-10 px-4 text-sm",
  sm: "h-8 px-3 text-xs",
}

export function buttonClass(variant: Variant = "primary", size: Size = "md") {
  return cx(
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed",
    variants[variant],
    sizes[size],
  )
}

export function Button(props: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  const variant = props.variant ?? "primary"
  const size = props.size ?? "md"
  return <button {...props} class={cx(buttonClass(variant, size), props.class)} />
}

export function Field(props: {
  label: string
  name: string
  type?: string
  value?: string
  placeholder?: string
  required?: boolean
  autocomplete?: string
  disabled?: boolean
  hint?: string
  error?: string
  onInput?: JSX.EventHandlerUnion<HTMLInputElement, InputEvent>
}) {
  return (
    <label class="block">
      <span class="mb-1.5 block text-sm font-medium text-slate-700">{props.label}</span>
      <input
        class={cx(
          "h-10 w-full rounded-lg bg-white px-3 text-sm text-slate-900 ring-1 ring-inset outline-none transition placeholder:text-slate-400 focus:ring-2",
          props.error ? "ring-rose-400 focus:ring-rose-500" : "ring-slate-300 focus:ring-indigo-500",
          props.disabled && "bg-slate-100 text-slate-500",
        )}
        name={props.name}
        type={props.type ?? "text"}
        value={props.value}
        placeholder={props.placeholder}
        required={props.required}
        autocomplete={props.autocomplete}
        disabled={props.disabled}
        onInput={props.onInput}
      />
      <Show when={props.hint && !props.error}>
        <span class="mt-1 block text-xs text-slate-500">{props.hint}</span>
      </Show>
      <Show when={props.error}>
        <span class="mt-1 block text-xs text-rose-600">{props.error}</span>
      </Show>
    </label>
  )
}

export function Select(props: {
  label: string
  name: string
  value?: string
  disabled?: boolean
  onSelect?: (value: string) => void
  children: JSX.Element
}) {
  return (
    <label class="block">
      <span class="mb-1.5 block text-sm font-medium text-slate-700">{props.label}</span>
      <select
        class="h-10 w-full rounded-lg bg-white px-3 text-sm text-slate-900 ring-1 ring-inset ring-slate-300 outline-none transition focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-500"
        name={props.name}
        value={props.value}
        disabled={props.disabled}
        onChange={(event) => props.onSelect?.(event.currentTarget.value)}
      >
        {props.children}
      </select>
    </label>
  )
}

const tones = {
  neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  warning: "bg-amber-50 text-amber-700 ring-amber-200",
  danger: "bg-rose-50 text-rose-700 ring-rose-200",
  brand: "bg-indigo-50 text-indigo-700 ring-indigo-200",
} as const

export function Badge(props: { tone?: keyof typeof tones; children: JSX.Element }) {
  return (
    <span
      class={cx(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        tones[props.tone ?? "neutral"],
      )}
    >
      {props.children}
    </span>
  )
}

export function Card(props: { children: JSX.Element; class?: string }) {
  return <section class={cx("rounded-xl bg-white p-6 ring-1 ring-slate-200", props.class)}>{props.children}</section>
}

export function PageHeader(props: { title: string; subtitle?: string; actions?: JSX.Element }) {
  return (
    <div class="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-slate-900">{props.title}</h1>
        <Show when={props.subtitle}>
          <p class="mt-1 text-sm text-slate-600">{props.subtitle}</p>
        </Show>
      </div>
      <Show when={props.actions}>
        <div class="flex items-center gap-2">{props.actions}</div>
      </Show>
    </div>
  )
}

export function EmptyState(props: { children: JSX.Element }) {
  return (
    <div class="rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
      {props.children}
    </div>
  )
}

export function Rows(props: { children: JSX.Element }) {
  return <div class="divide-y divide-slate-100">{props.children}</div>
}

export function Row(props: { children: JSX.Element }) {
  return <div class="flex flex-wrap items-center gap-4 py-3">{props.children}</div>
}

export function List(props: { children: JSX.Element }) {
  return <ul class="space-y-2">{props.children}</ul>
}

export function ListItem(props: { children: JSX.Element }) {
  return <li class="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{props.children}</li>
}

export function Separator() {
  return <hr class="my-6 border-slate-200" />
}

export function StatGrid(props: { items: Array<{ label: string; value: number | string }> }) {
  return (
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <For each={props.items}>
        {(item) => (
          <div class="rounded-xl bg-white p-5 ring-1 ring-slate-200">
            <div class="text-sm text-slate-500">{item.label}</div>
            <div class="mt-1 text-3xl font-semibold tracking-tight text-slate-900">{item.value}</div>
          </div>
        )}
      </For>
    </div>
  )
}
