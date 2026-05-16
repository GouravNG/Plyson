- ability for nested folder for schema,handlers,scripts
- need to revisit the generators to simplfy the implementation approch
- current flag implementation is coupled to header only this need to be generic
- need check whether assertion title is working either is log or report
- confirm that extractedd value are used as assertion
- Main gaps compared to the sample are username, password, birthdate,
  address/location, company, jobTitle, commerce/product, arrayElement.
- ref enhncement support extend node (tbd)
- loops
- workers utilitis of faker support
- support for \*.env files

notes:
:${key} path param pattern

And Faker options become normal JSON properties:

faker.number.int({ min: 18, max: 65 })

becomes:

{ "$gen": "number", "min": 18, "max": 65 }

Good mental model:

{
"$gen": "<supported-generator-name>",
"...faker-like-options": "..."
}

Examples for someone who knows Faker:

| Faker style                                                    | Play-son $gen style           |
| -------------------------------------------------------------- | ----------------------------- |
| faker.string.uuid()                                            | { "$gen": "uuid" }            |
| faker.internet.email()                                         | { "$gen": "email" }           |
| faker.internet.email({ provider: "test.com" })                 | { "$gen": "email",            |
| "domain": "test.com" }                                         |
| faker.person.firstName()                                       | { "$gen": "firstName" }       |
| faker.person.fullName({ sex: "male" })                         | { "$gen": "fullName", "sex":  |
| "male" }                                                       |
| faker.phone.number({ style: "international" })                 | { "$gen":                     |
| "phoneNumber", "style": "international" }                      |
| faker.number.int({ min: 1, max: 100 })                         | { "$gen": "number", "min": 1, |
| "max": 100 }                                                   |
| faker.number.float({ min: 1, max: 10, fractionDigits: 2 })     | { "$gen":                     |
| "number", "min": 1, "max": 10, "float": true, "precision": 2 } |
| faker.datatype.boolean()                                       | { "$gen": "boolean" }         |
| faker.date.future()                                            | { "$gen": "futureDate" }      |
| faker.date.past()                                              | { "$gen": "pastDate" }        |

So you can tell them:

> If you know Faker, think of $gen as a JSON-friendly alias for a Faker
> call. Put the method name in $gen, then pass the options beside it.

Example payload:

{
"id": { "$gen": "uuid" },
    "name": { "$gen": "fullName" },
"email": { "$gen": "email", "domain": "test.com" },
    "age": { "$gen": "number", "min": 18, "max": 65 },
"createdAt": { "$gen": "date", "format": "iso" }
}

One important note: it does not support every Faker method. It only
supports the built-in generator names your library exposes, like uuid,
email, firstName, fullName, number, string, boolean, date, pastDate,
futureDate, phoneNumber, url, and ipAddress.
