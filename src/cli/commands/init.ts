import { Command } from 'commander';
import fs from 'fs';
import path from 'path';

export const initCommand = new Command('init')
  .description('Create full directory structure with placeholder files')
  .argument('[project-name]', 'Name of the project', '.')
  .action((projectName) => {
    const rootDir = path.resolve(projectName);
    console.log(`Initializing play-son project in ${rootDir}...`);

    const dirs = [
      'environments',
      'schemas',
      'handlers',
      'scripts',
      'suites',
    ];

    if (!fs.existsSync(rootDir)) {
      fs.mkdirSync(rootDir, { recursive: true });
    }

    dirs.forEach((dir) => {
      const dirPath = path.join(rootDir, dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
    });

    // Create placeholder files
    const placeholders = {
      'project.json': {
        title: projectName === '.' ? 'New API Project' : projectName,
        description: 'API testing project created with play-son',
        version: '1.0.0',
        defaultEnv: 'dev'
      },
      'variables.json': {
        "//": "Global variables available to all suites",
        "appName": "MyDemoAPI"
      },
      'environments/dev.env.json': {
        "//": "Environment-specific configuration",
        "baseUrl": "http://localhost:3000",
        "variables": {
          "adminEmail": "admin@example.com"
        }
      },
      'suites/sample.test.json': {
        "title": "Sample Suite",
        "description": "Welcome to play-son! This is a sample test suite.",
        "tags": ["smoke"],
        "testCases": [
          {
            "id": "sample-get",
            "title": "Should return 200 OK from root",
            "steps": [
              {
                "title": "GET /",
                "request": {
                  "method": "GET",
                  "endpoint": "/"
                },
                "response": {
                  "validations": {
                    "statusCode": 200
                  }
                }
              }
            ]
          }
        ]
      }
    };

    Object.entries(placeholders).forEach(([filename, content]) => {
      const filePath = path.join(rootDir, filename);
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
        console.log(`Created ${filename}`);
      } else {
        console.log(`${filename} already exists, skipping.`);
      }
    });

    console.log('\nProject initialized successfully!');
    console.log('Next steps:');
    console.log('1. Edit project.json and environments/dev.env.json');
    console.log('2. Add your first test in suites/sample.test.json');
    console.log('3. Run tests with: playson run --env dev');
  });
