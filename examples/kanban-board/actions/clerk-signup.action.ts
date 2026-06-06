import { createClerkClient } from '@clerk/backend'
import { ActionContext } from '@plyson/test'

export default async function signUp({ args, log, store }: ActionContext) {
  const email: string = args.email
  const password: string = args.password

  // validate the required arguments
  if (!email || !password) {
    throw new Error('Email and password are required to create a user.')
  }

  log(`Creating a new user with the provided email: ${email}.`)
  // retrive the user id from clerk
  const CLERK_SECRET_KEY = store.get('CLERK_SECRET_KEY') as string

  if (!CLERK_SECRET_KEY) {
    throw new Error('CLERK_SECRET_KEY is missing from the variable store.')
  }

  const clerk = createClerkClient({ secretKey: CLERK_SECRET_KEY })

  log('Clerk secret key found. Creating user in Clerk.')
  const user = await clerk.users.createUser({
    emailAddress: [email],
    password,
  })
  log(`Clerk user created: ${user.id}`)

  // retrive the session and token
  log('Creating Clerk session.')
  const session = await clerk.sessions.createSession({
    userId: user.id,
  })
  log(`Clerk session created: ${session.id}`)

  log('Requesting Supabase JWT from Clerk session.')
  const { jwt } = await clerk.sessions.getToken(session.id, 'supabase')
  if (!jwt) {
    throw new Error('Clerk did not return a Supabase JWT. Check the Clerk JWT template named "supabase".')
  }

  // store the require variables.
  store.set('USER_ID', user.id, 'global')
  store.set('API_KEY', jwt, 'global')
  log('Stored USER_ID and API_KEY in the variable store.')
}
