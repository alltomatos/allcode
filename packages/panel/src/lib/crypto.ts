import { env } from "./env"
// Workers WebCrypto rejects PBKDF2 iteration counts above 100000.
const ITERATIONS = 100_000
const KEY_BITS = 256

function encodeBase64(bytes: Uint8Array) {
  let value = ""
  for (const byte of bytes) value += String.fromCharCode(byte)
  return btoa(value)
}

function decodeBase64(value: string) {
  const raw = atob(value)
  const bytes = new Uint8Array(raw.length)
  for (let index = 0; index < raw.length; index++) bytes[index] = raw.charCodeAt(index)
  return bytes
}

async function peppered(password: string) {
  const pepper = env("PANEL_PASSWORD_PEPPER", "")
  if (!pepper) return password
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pepper),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(password))
  return encodeBase64(new Uint8Array(signature))
}

async function derive(password: string, salt: Uint8Array<ArrayBuffer>) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
    "deriveBits",
  ])
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS },
    key,
    KEY_BITS,
  )
  return new Uint8Array(bits)
}

function equal(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false
  let diff = 0
  for (let index = 0; index < left.length; index++) diff |= left[index]! ^ right[index]!
  return diff === 0
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await derive(await peppered(password), salt)
  return `pbkdf2$sha256$${ITERATIONS}$${encodeBase64(salt)}$${encodeBase64(hash)}`
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, digest, iterations, salt, hash] = stored.split("$")
  if (scheme !== "pbkdf2" || digest !== "sha256" || Number(iterations) !== ITERATIONS) return false
  if (!salt || !hash) return false
  const derived = await derive(await peppered(password), decodeBase64(salt))
  return equal(derived, decodeBase64(hash))
}

const ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*"

export function generatePassword(length = 16) {
  const values = crypto.getRandomValues(new Uint32Array(length))
  let password = ""
  for (const value of values) password += ALPHABET[value % ALPHABET.length]
  return password
}
