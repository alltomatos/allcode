export * as File from "./file"

import { Revert } from "@allcode/schema/revert"

export const Diff = Revert.FileDiff
export type Diff = typeof Diff.Type
