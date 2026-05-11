export interface HandlerContext {
  request: any
  response: any
  body: any
  status: number
  store: {
    get: (name: string) => any
    set: (name: string, value: any, scope: any) => void
  }
  warn: (title: string, message: string) => void
}

export class HandlerRunner {
  async run(): Promise<void> {}
}
