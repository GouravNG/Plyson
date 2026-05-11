// =========================================================================================================
// Foundation types
// =========================================================================================================
// holds the values of the variables defined at different levels such as project, suite or case level
// global level variable exist in its own file in root with variable.json file
type Variables = Record<string, any>

/**
 * Represents a dynamic data generator object.
 * Used for on-the-fly data creation via Faker.js.
 */
export type GeneratorObject = {
  $gen: string
  [key: string]: any
}

/**
 * Values in the variable store can be primitives, arrays, objects,
 * or generator objects that need resolution.
 */
export type VariableValue =
  | string
  | number
  | boolean
  | null
  | any[]
  | Record<string, any>
  | GeneratorObject

// =========================================================================================================
// Network types
// =========================================================================================================
// HTTP methods supported in the test steps
type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS'

type AssertionOperators =
  | 'equals'
  | 'notEquals'
  | 'exists'
  | 'notExists'
  | 'isNull'
  | 'isNotNull'
  | 'isGreaterThan'
  | 'isLessThan'
  | 'isGreaterThanOrEquals'
  | 'isLessThanOrEquals'
  | 'contains'
  | 'notContains'
  | 'matches'
  | 'notMatches'
  | 'hasLength'
  | 'hasMinLength'
  | 'hasMaxLength'
  | 'includes'
  | 'notIncludes'
  | 'isEmpty'
  | 'isNotEmpty'
  | 'containsSubset'
  | 'notContainsSubset'
  | 'isString'
  | 'isNumber'
  | 'isBoolean'
  | 'isArray'
  | 'isObject'

// auto fill property helps in automatic fill of the request payload values
// from the request schema ( extracted from the swagger or openapi specification )
// based on the configuration provided in the test step
// includeFields will only include the specified fields from the request schema in the payload
// excludeFields will include all the fields from the request schema except the specified fields in the payload
// if include or exclude not specified then all the fields from the request schema will be included in the payload
type AutoFillFields =
  | { includeFields: string[] }
  | { excludeFields: string[] }
  | Record<string, never> // empty object — schemaName only
type AutoFillType = false | ({ schemaName: string } & AutoFillFields)

type Req = {
  method: HTTPMethod
  endpoint: string
  queryParams?: Record<string, any>
  pathParams?: Record<string, any>
  headers?: Record<string, any>
  autoFill?: AutoFillType
  // payloaad and autoFill eventually  work as js spread operator
  // where autoFill will fill the payload with the values from the
  // request schema based on the configuration provided and then
  // payload will override those values with the values provided in
  // the test step if there are any conflicts in the keys
  payload?: Record<string, any>
}

type Res = {
  // Response schema validation configuration
  // validation can be either boolean or "warn"
  // usefull in finding breaking changes earliest
  // if validation is true then the response schema validation will be performed and any validation error will be marked as error in the test report
  // if validation is "warn" then the response schema validation will be performed and any validation error will be marked as warning in the test report
  schema?: {
    name: string
    // true by default
    validation?: boolean | 'warn'
  }
  validations: {
    //can be single status code or an array of status codes
    statusCode: number | number[]
    assertions?: Assertions[]
  }
  extract?: ExtractedValue[]
}

type Assertions = {
  // name for the assertion which will be used in the test report to identify the assertion
  title: string
  // response body or header to perform the assertion on
  from: 'body' | 'header'
  // JSON Path or JMESPath to specify the field in the
  // however for the header this would be key name of the header
  path: string
  operator: AssertionOperators
  value?: any
  //   default will be error
  // error by default
  validation?: 'warn' | 'error'
}

interface ExtractedValue {
  name: string
  from: 'body' | 'header'
  //   can be key , JSON path or JMESPath  header
  path: string
  // extracted values will be stored as the variables  at the respective scope
  scope: 'case' | 'suite' | 'global'
}

type CommonTestStep = {
  // meta
  title: string
  description?: string
  // actions
  disabled?: boolean
  //   wait time in milliseconds before executing the step
  wait?: number
  //   flag are the features that can be used to enable or disable certain functionalities in the test step
  // such as skip_auth flag that automatically remove the authorization header from the request
  flags?: string[]
  //   handlers will the the typescript functions to with the request and
  //  response objects as parameters to perform any custom operations such as
  //  dynamic extraction or custom logic validtion etc
  // these handler files will be having the file name convention of *.handlers.ts and will be located in handlers directory at the root level of the project
  handlers?: string[]
  // request
  request: Req
  // response
  response: Res
}

// =========================================================================================================
// TEST CASES
// =========================================================================================================

type ReferencedTestStep = {
  ref: string
  description?: string
}

type InlineTestStep = CommonTestStep & { ref?: never }

type TestStep = ReferencedTestStep | InlineTestStep

// Test cases can be the standalone as well, can be store in seperate folder
// named scripts with pattern *.scripts.ts
// these can be reference with ref of type ReferencedTestStep type.

type Testcase = {
  // meta
  // unique identifier for the testcase
  id: string
  title: string
  description?: string
  // defaults to the false
  disabled?: boolean
  // will be a handled using the tags just need to add this testtype as tag while handling this.
  testType?: 'positive' | 'negative'
  variables?: Variables
  // playwrigh tags
  tags: string[]
  //steps to validate the test case
  steps: TestStep[]
}

// =========================================================================================================
// TEST SUITES & Projects
// =========================================================================================================
// with in the suites folder with ever the JSON with *.test.json will be considered as test suite.
type TestSuite = {
  title: string
  description?: string
  // to toggle all the testcases within them at suite level
  // defaults to false
  disabled?: boolean
  // suite level tags which will be availabe for all the test cases within the suite
  tags: string[]
  variables?: Variables
  beforeAll?: TestStep[]
  afterAll?: TestStep[]
  testCases: Testcase[]
}

// in root of the project with name project.json these will be present
type Project = {
  title: string
  description?: string
  // should be referencedd from teh packge.json of the project
  version: string
  // Global level before and after calls
  beforeAll?: TestStep[]
  afterAll?: TestStep[]
  // usefull when running the CLI
  defaultEnv?: string
}

// in root with in the folder named "environments" these details will be present
// envoroments will have this file conventions *.env.json example dev.env.json , staging.env.json etc
// while running the script --env=<env_name> example --env=dev will be used to specify the environment
// basedd on this details specifc environement JSON(in above case dev.env.json) will be picked and so are the vaiables inside them.
type EnvironmentVariables = {
  // API Domain of the service
  baseUrl: string
  // OPENAPI or Swagger spec URL
  // this can be used to retrive the request or response schema
  specUrl?: string
  // any other global env dependent variables
  variables?: Variables
}
