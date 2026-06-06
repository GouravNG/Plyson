import { createClerkClient } from '@clerk/backend'
import { ActionContext } from '@plyson/test'

export default async function deleteUser({ log, store }: ActionContext) {
  const userId = store.get('USER_ID') as string

  if (!userId) throw new Error('No USER_ID found in store')

  // retrive the user id from clerk
  const CLERK_SECRET_KEY = store.get('CLERK_SECRET_KEY') as string
  const clerk = createClerkClient({ secretKey: CLERK_SECRET_KEY })

  log(`Deleting user: ${userId}`)
  await clerk.users.deleteUser(userId)

  log('User deleted successfully!')
  store.set('USER_ID', null, 'suite')
  store.set('USER_TOKEN', null, 'suite')
}
