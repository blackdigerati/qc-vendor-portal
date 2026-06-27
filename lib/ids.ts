import { customAlphabet } from 'nanoid'

const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const nano = customAlphabet(alphabet, 12)

export function newId(prefix?: string) {
  return prefix ? `${prefix}_${nano()}` : nano()
}
