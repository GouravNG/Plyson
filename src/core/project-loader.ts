import { Project, TestSuite, Testcase, EnvironmentVariables, Variables } from '../types'

export interface ProjectGraph {
  project: Project
  variables: Variables
  environment: EnvironmentVariables
  schemas: Map<string, any>
  handlers: Map<string, any>
  scripts: Map<string, Testcase>
  suites: TestSuite[]
}

export class ProjectLoader {
  async load(rootDir: string, env: string): Promise<ProjectGraph> {
    throw new Error('Not implemented')
  }
}
