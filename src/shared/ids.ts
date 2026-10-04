import { v7 as uuidv7 } from 'uuid'

/** A new time-sortable UUIDv7 string. */
export function newId(): string {
  return uuidv7()
}
