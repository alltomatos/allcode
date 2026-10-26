import type { WaClient } from "zapo-js"

/**
 * Operações de grupo suportadas pelo `WaGroupCoordinator` do `zapo`.
 * O grupo é sempre endereçado pelo JID (`...@g.us`).
 */

export interface GroupSummary {
  jid: string
  subject: string
  participantCount: number
  isAdmin: boolean
  isSuperAdmin: boolean
  creation?: number
  desc?: string
}

function isMe(participantJid: string, meJid?: string, meLid?: string): boolean {
  const digits = (value?: string) => (value ? value.split("@")[0].split(":")[0].replace(/\D+/g, "") : "")
  const target = digits(participantJid)
  if (!target) return false
  return [digits(meJid), digits(meLid)].filter(Boolean).some((id) => target === id || target.includes(id))
}

export async function queryGroups(
  client: WaClient,
  input: { onlyAdmin?: boolean } = {},
): Promise<GroupSummary[]> {
  const meJid = client.getCredentials()?.meJid
  const meLid = client.getCredentials()?.meLid
  const all = await client.group.queryAllGroups()

  const groups = all.map((group) => {
    const me = (group.participants ?? []).find((participant) => isMe(participant.jid, meJid, meLid))
    const isAdmin = Boolean(me?.isAdmin || me?.isSuperAdmin)
    return {
      jid: group.jid,
      subject: group.subject || "(sem assunto)",
      participantCount: group.size ?? group.participants?.length ?? 0,
      isAdmin,
      isSuperAdmin: Boolean(me?.isSuperAdmin),
      creation: group.creation,
      desc: group.desc,
    }
  })

  return input.onlyAdmin ? groups.filter((group) => group.isAdmin) : groups
}

export async function queryGroupInfo(client: WaClient, groupId: string) {
  const meta = await client.group.queryGroupMetadata(groupId)
  const meJid = client.getCredentials()?.meJid
  const meLid = client.getCredentials()?.meLid
  const me = (meta.participants ?? []).find((participant) => isMe(participant.jid, meJid, meLid))
  return {
    jid: meta.jid,
    subject: meta.subject,
    participantCount: meta.size ?? meta.participants?.length ?? 0,
    isAdmin: Boolean(me?.isAdmin || me?.isSuperAdmin),
    isSuperAdmin: Boolean(me?.isSuperAdmin),
    creation: meta.creation,
    desc: meta.desc,
    owner: meta.owner,
    announceOnly: meta.announce,
    locked: meta.restrict,
    participants: (meta.participants ?? []).map((participant) => ({
      jid: participant.jid,
      name: participant.displayName || participant.username || participant.phoneNumber,
      phone: participant.phoneNumber,
      isAdmin: Boolean(participant.isAdmin || participant.isSuperAdmin),
      isSuperAdmin: Boolean(participant.isSuperAdmin),
    })),
  }
}

export async function queryGroupParticipants(client: WaClient, groupId: string) {
  const info = await queryGroupInfo(client, groupId)
  return info.participants
}

export async function createGroup(client: WaClient, input: { subject: string; participants: readonly string[] }) {
  const meta = await client.group.createGroup(input.subject, input.participants)
  return { jid: meta.jid, subject: meta.subject }
}

export async function addGroupParticipants(
  client: WaClient,
  input: { groupId: string; participants: readonly string[] },
) {
  return client.group.addParticipants(input.groupId, input.participants)
}

export async function removeGroupParticipants(
  client: WaClient,
  input: { groupId: string; participants: readonly string[] },
) {
  return client.group.removeParticipants(input.groupId, input.participants)
}

export async function promoteGroupParticipants(
  client: WaClient,
  input: { groupId: string; participants: readonly string[] },
) {
  return client.group.promoteParticipants(input.groupId, input.participants)
}

export async function demoteGroupParticipants(
  client: WaClient,
  input: { groupId: string; participants: readonly string[] },
) {
  return client.group.demoteParticipants(input.groupId, input.participants)
}

export async function groupInviteLink(client: WaClient, groupId: string) {
  const code = await client.group.queryInviteCode(groupId)
  return { code, url: `https://chat.whatsapp.com/${code}` }
}

export async function revokeGroupInvite(client: WaClient, groupId: string) {
  const result = await client.group.revokeInvite(groupId)
  return { code: (result as { code?: string }).code }
}
