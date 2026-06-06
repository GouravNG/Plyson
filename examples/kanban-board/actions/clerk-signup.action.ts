import { createClerkClient } from '@clerk/backend'
import { ActionContext } from '@plyson/test'

export default async function signUp({ args, log, store }: ActionContext) {
  const email: string = args.email
  const password: string = args.password

  // validate the required arguments
  if (!email || !password) {
    throw new Error('Email and password are required to create a user.')
  }

  log(`Creating a new user with the provided email: ${email} and password: ${password}.`)
  // retrive the user id from clerk
  const CLERK_SECRET_KEY = store.get('CLERK_SECRET_KEY') as string
  const clerk = createClerkClient({ secretKey: CLERK_SECRET_KEY })
  
  const user = await clerk.users.createUser({
    emailAddress: [email],
    password,
  })

  // retrive the session and token
  const session = await clerk.sessions.createSession({
    userId: user.id,
  })
  const { jwt } = await clerk.sessions.getToken(session.id, 'supabase')

  // store the require variables.
  store.set('USER_ID', user.id, 'global')
  store.set('API_KEY', jwt, 'global')
}
