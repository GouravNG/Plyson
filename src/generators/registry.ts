export class GeneratorRegistry {
  static register(name: string, generator: any): void {}
  static run(name: string, options: any): any {}
  static has(name: string): boolean {
    return false
  }
}

export interface Generator<O = Record<string, unknown>> {
  run(options: O): any
}
