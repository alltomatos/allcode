import { MailAccounts } from "@/mail-accounts"
import { PositiveInt } from "@allcode/core/schema"
import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiError, HttpApiGroup, OpenApi } from "effect/unstable/httpapi"
import { Authorization } from "../middleware/authorization"
import { InstanceContextMiddleware } from "../middleware/instance-context"
import { WorkspaceRoutingMiddleware, WorkspaceRoutingQuery } from "../middleware/workspace-routing"
import { described } from "./metadata"

const NonEmptyString = Schema.String.check(Schema.isMinLength(1))

export const SmtpPayload = Schema.Struct({
  host: NonEmptyString,
  port: PositiveInt,
  secure: Schema.Boolean,
})

export const UpsertPayload = Schema.Struct({
  id: NonEmptyString,
  label: NonEmptyString,
  provider: Schema.String,
  host: NonEmptyString,
  port: PositiveInt,
  secure: Schema.Boolean,
  user: NonEmptyString,
  appPassword: NonEmptyString,
  smtp: Schema.optional(SmtpPayload),
  sentFolder: Schema.optional(Schema.String),
})

export const AccountList = Schema.Array(MailAccounts.AccountSummary)
export const TestResultPayload = MailAccounts.TestResult

export const MailAccountsPaths = {
  collection: "/mail/accounts",
  test: "/mail/accounts/test",
  item: "/mail/accounts/:id",
} as const

export const MailAccountsApi = HttpApi.make("mail-accounts").add(
  HttpApiGroup.make("mailAccounts")
    .add(
      HttpApiEndpoint.get("list", MailAccountsPaths.collection, {
        query: WorkspaceRoutingQuery,
        success: described(AccountList, "Configured mail accounts (without secrets)"),
        error: HttpApiError.BadRequest,
      }).annotateMerge(
        OpenApi.annotations({
          identifier: "mailAccounts.list",
          summary: "List mail accounts",
          description: "List configured mcpmail accounts (App Password never included in the response).",
        }),
      ),
      HttpApiEndpoint.post("test", MailAccountsPaths.test, {
        query: WorkspaceRoutingQuery,
        payload: UpsertPayload,
        success: described(TestResultPayload, "Test connection result for IMAP and SMTP"),
        error: HttpApiError.BadRequest,
      }).annotateMerge(
        OpenApi.annotations({
          identifier: "mailAccounts.test",
          summary: "Test mail account connection",
          description: "Test IMAP and optional SMTP credentials and connectivity before saving.",
        }),
      ),
      HttpApiEndpoint.post("add", MailAccountsPaths.collection, {
        query: WorkspaceRoutingQuery,
        payload: UpsertPayload,
        success: described(AccountList, "Mail account saved successfully"),
        error: HttpApiError.BadRequest,
      }).annotateMerge(
        OpenApi.annotations({
          identifier: "mailAccounts.add",
          summary: "Add or update a mail account",
          description:
            "Create or update a mcpmail account (IMAP/SMTP + App Password) and (re)register the mcpmail MCP server.",
        }),
      ),
      HttpApiEndpoint.delete("remove", MailAccountsPaths.item, {
        params: { id: Schema.String },
        query: WorkspaceRoutingQuery,
        success: described(AccountList, "Mail account removed successfully"),
        error: HttpApiError.BadRequest,
      }).annotateMerge(
        OpenApi.annotations({
          identifier: "mailAccounts.remove",
          summary: "Remove a mail account",
          description: "Remove a configured mcpmail account.",
        }),
      ),
    )
    .annotateMerge(
      OpenApi.annotations({
        title: "mailAccounts",
        description: "Mail accounts (mcpmail) configuration routes.",
      }),
    )
    .middleware(InstanceContextMiddleware)
    .middleware(WorkspaceRoutingMiddleware)
    .middleware(Authorization),
)

