import { HandlerContext } from '../core/handler-runner'

export async function run(ctx: HandlerContext) {
  const body = ctx.body as any
  if (body.role !== 'admin') {
    throw new Error(`Handler assertion failed: expected role 'admin', got '${body.role}'`)
  }
  
  // Custom extraction
  ctx.store.set('handler_extracted', 'success', 'case')
}
