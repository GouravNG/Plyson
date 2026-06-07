import { createClerkClient } from '@clerk/backend'
import { ActionContext } from '@plyson/test'

export default async function login({ args, log, store }: ActionContext) {
  const email: string = args.email
  const password: string = args.password

  // validate the required arguments
  if (!email || !password) {
    throw new Error('Email and password are required to create a user.')
  }

  log(`Logging in user: ${email} with password: ${password}.`)
  // retrive the user id from clerk
  const CLERK_SECRET_KEY = store.get('CLERK_SECRET_KEY') as string
  const clerk = createClerkClient({ secretKey: CLERK_SECRET_KEY })

  log(`Logging in user: ${email}`)

  const { data: users } = await clerk.users.getUserList({
    emailAddress: [email],
  })

  if (!users.length) throw new Error(`No user found for: ${email}`)

  const { verified } = await clerk.users.verifyPassword({
    userId: users[0].id,
    password,
  })

  if (!verified) throw new Error('Invalid password')

  const session = await clerk.sessions.createSession({ userId: users[0].id })
  const { jwt } = await clerk.sessions.getToken(session.id, 'supabase')

  store.set('USER_ID', users[0].id, 'suite')
  store.set('USER_TOKEN', jwt, 'suite')
}
