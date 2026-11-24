import { cycleWindow, effectiveUserLimit, resolveQuotaState, type QuotaState, type UserQuotaSource } from "./quota"
import { store } from "./store"

export type QuotaContext = QuotaState & {
  orgID: string
  userID?: string
  userQuotaSource: UserQuotaSource
  userOverrideLimit: number | null
}

export async function loadQuotaState(orgID: string, userID?: string): Promise<QuotaContext> {
  const db = store()
  const org = await db.org.get(orgID)
  const cycle = cycleWindow(org.tokenQuotaCycleDay ?? 1)
  const companyUsed = await db.quota.getOrgUsage(orgID, cycle.start)

  const user = userID ? await db.users.findByID(userID) : undefined
  const userUsed = user ? await db.quota.getUserUsage(user.id, cycle.start) : 0
  const effective = effectiveUserLimit({
    individual: user?.tokenQuota ?? null,
    global: org.userTokenQuota ?? null,
    companyPool: org.tokenQuota ?? null,
  })

  return {
    orgID,
    ...(userID ? { userID } : {}),
    userQuotaSource: effective.source,
    userOverrideLimit: user?.tokenQuota ?? null,
    ...resolveQuotaState({
      companyLimit: org.tokenQuota ?? null,
      userLimit: effective.limit,
      companyUsed,
      userUsed,
      cycleStart: cycle.start,
      cycleEnd: cycle.end,
    }),
  }
}

export async function recordUsage(input: {
  orgID: string
  userID: string
  sessionID: string
  tokens: number
}) {
  const db = store()
  const org = await db.org.get(input.orgID)
  const cycle = cycleWindow(org.tokenQuotaCycleDay ?? 1)
  await db.quota.record({
    sessionID: input.sessionID,
    orgID: input.orgID,
    userID: input.userID,
    tokens: input.tokens,
    cycleStart: cycle.start,
  })
  return loadQuotaState(input.orgID, input.userID)
}

export async function loadQuotaOverview(orgID: string) {
  const db = store()
  const org = await db.org.get(orgID)
  const cycle = cycleWindow(org.tokenQuotaCycleDay ?? 1)
  const usage = await db.quota.getUsageByUser(orgID, cycle.start)
  const users = await db.users.list(orgID)
  return {
    cycleStart: cycle.start,
    cycleEnd: cycle.end,
    company: {
      limit: org.tokenQuota ?? null,
      used: Object.values(usage).reduce((total, value) => total + value, 0),
    },
    users: users.map((user) => {
      const used = usage[user.id] ?? 0
      const effective = effectiveUserLimit({
        individual: user.tokenQuota ?? null,
        global: org.userTokenQuota ?? null,
        companyPool: org.tokenQuota ?? null,
      })
      return {
        userID: user.id,
        limit: effective.limit,
        source: effective.source,
        overrideLimit: user.tokenQuota ?? null,
        used,
        remaining: effective.limit === null ? null : Math.max(0, effective.limit - used),
      }
    }),
  }
}
