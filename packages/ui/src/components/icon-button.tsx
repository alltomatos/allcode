import { Button as Kobalte } from "@kobalte/core/button"
import { type ComponentProps, splitProps } from "solid-js"
import { LoaderV2 } from "../v2/components/loader-v2"
import { Icon, IconProps } from "./icon"

export interface IconButtonProps extends ComponentProps<typeof Kobalte> {
  icon: IconProps["name"]
  size?: "small" | "normal" | "large"
  iconSize?: IconProps["size"]
  variant?: "primary" | "secondary" | "ghost"
  loading?: boolean
}

export function IconButton(props: ComponentProps<"button"> & IconButtonProps) {
  const [split, rest] = splitProps(props, ["variant", "size", "iconSize", "class", "classList", "loading"])
  return (
    <Kobalte
      {...rest}
      data-component="icon-button"
      data-icon={props.icon}
      data-size={split.size || "normal"}
      data-variant={split.variant || "secondary"}
      classList={{
        ...split.classList,
        [split.class ?? ""]: !!split.class,
      }}
    >
      {props.loading ? (
        <LoaderV2 width={split.size === "large" ? 18 : 14} height={split.size === "large" ? 18 : 14} />
      ) : (
        <Icon name={props.icon} size={split.iconSize ?? (split.size === "large" ? "normal" : "small")} />
      )}
    </Kobalte>
  )
}
