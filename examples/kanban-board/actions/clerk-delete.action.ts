import { createClerkClient } from '@clerk/backend'
import { ActionContext } from '@plyson/test'

export default async function deleteUser({ log, store }: ActionContext) {
  const userId = store.get('USER_ID') as string

  if (!userId) {
    log('No USER_ID found in store. Skipping Clerk user cleanup.')
    return
  }

  // retrive the user id from clerk
  const CLERK_SECRET_KEY = store.get('CLERK_SECRET_KEY') as string
  if (!CLERK_SECRET_KEY) {
    throw new Error('CLERK_SECRET_KEY is missing from the variable store.')
  }

  const clerk = createClerkClient({ secretKey: CLERK_SECRET_KEY })

  log(`Deleting user: ${userId}`)
  await clerk.users.deleteUser(userId)

  log('User deleted successfully!')
  store.set('USER_ID', null, 'global')
  store.set('API_KEY', null, 'global')
}
