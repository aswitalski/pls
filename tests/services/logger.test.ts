import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ComponentName } from '../../src/types/types.js';
import {
  ComponentDefinition,
  DebugDefinitionProps,
} from '../../src/types/components.js';

import { DebugLevel } from '../../src/configuration/types.js';

import {
  displayWarning,
  formatPromptContent,
  formatSkillsSummary,
  getDebugLevel,
  getWarnings,
  initializeLogger,
  logPrompt,
  logResponse,
  PromptDisplay,
  resetSessionLog,
  setDebugLevel,
  setFileSystem,
} from '../../src/services/logger.js';
import {
  defaultFileSystem,
  FileSystem,
  MemoryFileSystem,
} from '../../src/services/filesystem.js';
import { Palette } from '../../src/services/colors.js';

describe('Logger service', () => {
  // Helper to extract debug props from component definition
  function getDebugProps(
    component: ComponentDefinition | null
  ): DebugDefinitionProps {
    if (!component) {
      throw new Error('Component is null');
    }
    return component.props as DebugDefinitionProps;
  }

  // Use memory filesystem for all tests to avoid real file I/O
  let memoryFs: MemoryFileSystem;

  beforeEach(() => {
    memoryFs = new MemoryFileSystem();
    setFileSystem(memoryFs);
    resetSessionLog();
    setDebugLevel(DebugLevel.None);
  });

  afterEach(() => {
    setDebugLevel(DebugLevel.None);
    resetSessionLog();
    setFileSystem(defaultFileSystem);
  });

  describe('Debug level management', () => {
    it('defaults to None level', () => {
      expect(getDebugLevel()).toBe(DebugLevel.None);
    });

    it('sets and gets debug level', () => {
      setDebugLevel(DebugLevel.Info);
      expect(getDebugLevel()).toBe(DebugLevel.Info);

      setDebugLevel(DebugLevel.Verbose);
      expect(getDebugLevel()).toBe(DebugLevel.Verbose);

      setDebugLevel(DebugLevel.None);
      expect(getDebugLevel()).toBe(DebugLevel.None);
    });

    it('initializes from config', () => {
      // Note: This loads from actual user config, so we just verify it doesn't crash
      // and returns a valid debug level
      initializeLogger();
      const level = getDebugLevel();
      expect([DebugLevel.None, DebugLevel.Info, DebugLevel.Verbose]).toContain(
        level
      );
    });
  });

  describe('Formatting prompt content', () => {
    const baseInstructions = 'You are a planning assistant.';
    const formattedSkills = `
## Available Skills

The following skills define domain-specific workflows.

### Name
Deploy App

### Description
Deploy to production server

### Aliases
- deploy
- push to prod

### Steps
- Build the project
- Upload files

### Execution
- npm run build
- rsync dist/ server:/app

### Name
Run Tests

### Steps
- Run unit tests

### Execution
- npm test`;

    it('LLM mode includes base instructions and formatted skills', () => {
      const result = formatPromptContent(
        'schedule',
        'deploy the app',
        baseInstructions,
        formattedSkills,
        PromptDisplay.LLM
      );

      expect(result).toContain('**Tool:** schedule');
      expect(result).toContain('You are a planning assistant.');
      expect(result).toContain('## Available Skills');
      expect(result).toContain('Deploy App');
    });

    it('Skills mode shows skills with separators but no base instructions', () => {
      const result = formatPromptContent(
        'schedule',
        'deploy',
        baseInstructions,
        formattedSkills,
        PromptDisplay.Skills
      );

      expect(result).toContain('Tool: schedule');
      // Skills mode excludes base instructions
      expect(result).not.toContain('You are a planning assistant.');
      // Has separator lines (dashes matching content width)
      expect(result).toMatch(/^-+$/m);
      expect(result).toContain('## Available Skills');
      expect(result).toContain('Deploy App');
      expect(result).toContain('### Description');
      expect(result).toContain('Deploy to production server');
      expect(result).toContain('### Aliases');
      expect(result).toContain('- deploy');
      expect(result).toContain('### Steps');
      expect(result).toContain('### Execution');
    });

    it('Summary mode extracts only Name, Steps, and Execution', () => {
      const definitions = [
        {
          key: 'deploy-app',
          name: 'Deploy App',
          description: 'Deploy to production server',
          aliases: ['deploy', 'push to prod'],
          steps: ['Build the project', 'Upload files'],
          execution: ['npm run build', 'rsync dist/ server:/app'],
          isValid: true,
        },
        {
          key: 'run-tests',
          name: 'Run Tests',
          description: '',
          steps: ['Run unit tests'],
          execution: ['npm test'],
          isValid: true,
        },
      ];

      const result = formatPromptContent(
        'schedule',
        'deploy',
        baseInstructions,
        formattedSkills,
        PromptDisplay.Summary,
        definitions
      );

      expect(result).toContain('Tool: schedule');
      expect(result).toContain('Command: deploy');
      expect(result).toContain('## Available Skills');
      expect(result).toContain('### Name');
      expect(result).toContain('Deploy App');
      expect(result).toContain('### Steps');
      expect(result).toContain('- Build the project');
      expect(result).toContain('### Execution');
      expect(result).toContain('- npm run build');
    });

    it.each([PromptDisplay.Skills, PromptDisplay.Summary])(
      'shows "(no skills)" in %s mode when no skills provided',
      (mode) => {
        const result = formatPromptContent(
          'schedule',
          'list files',
          'instructions',
          '',
          mode
        );

        expect(result).toContain('Tool: schedule');
        expect(result).toContain('(no skills)');
      }
    );
  });

  describe('Formatting skills summary', () => {
    it('formats Name, Steps, and Execution from definitions', () => {
      const definitions = [
        {
          key: 'build-project',
          name: 'Build Project',
          description: 'Build the project for deployment',
          steps: ['Compile source', 'Bundle assets'],
          execution: ['npm run compile', 'npm run bundle'],
          isValid: true,
        },
      ];

      const result = formatSkillsSummary(definitions);

      expect(result).toContain('## Available Skills');
      expect(result).toContain('### Name');
      expect(result).toContain('Build Project');
      expect(result).toContain('### Steps');
      expect(result).toContain('- Compile source');
      expect(result).toContain('### Execution');
      expect(result).toContain('- npm run compile');
    });

    it('returns "(no skills)" for empty definitions', () => {
      expect(formatSkillsSummary([])).toBe('(no skills)');
    });

    it('handles multiple skills with separators', () => {
      const definitions = [
        {
          key: 'skill-one',
          name: 'Skill One',
          description: '',
          steps: ['Step 1'],
          execution: ['cmd1'],
          isValid: true,
        },
        {
          key: 'skill-two',
          name: 'Skill Two',
          description: '',
          steps: ['Step 2'],
          execution: ['cmd2'],
          isValid: true,
        },
      ];

      const result = formatSkillsSummary(definitions);

      expect(result).toContain('Skill One');
      expect(result).toContain('Skill Two');
      expect(result).toContain('- Step 1');
      expect(result).toContain('- Step 2');
      // Has separator lines
      expect(result).toMatch(/^-+$/m);
    });

    it('formats deployment workflow with config placeholders', () => {
      const definitions = [
        {
          key: 'deploy-app',
          name: 'Deploy Application',
          description: 'Deploy to production or staging',
          steps: [
            'Build the application',
            'Upload to server',
            'Restart service',
          ],
          execution: [
            'npm run build',
            'scp -r dist/* {deploy.VARIANT.server}:{deploy.VARIANT.path}',
            'ssh {deploy.VARIANT.server} "systemctl restart app"',
          ],
          isValid: true,
        },
      ];

      const result = formatSkillsSummary(definitions);

      expect(result).toContain('Deploy Application');
      expect(result).toContain('- Build the application');
      expect(result).toContain('- npm run build');
      // Preserves config placeholders in execution
      expect(result).toContain('{deploy.VARIANT.server}');
      expect(result).toContain('{deploy.VARIANT.path}');
    });
  });

  describe('Logging prompts', () => {
    it('returns null when debug level is None', () => {
      setDebugLevel(DebugLevel.None);
      const result = logPrompt('schedule', 'test command', 'instructions', '');
      expect(result).toBeNull();
    });

    it('returns null when debug level is Info', () => {
      setDebugLevel(DebugLevel.Info);
      const result = logPrompt('schedule', 'test command', 'instructions', '');
      expect(result).toBeNull();
    });

    it('creates debug component when debug level is Verbose', () => {
      setDebugLevel(DebugLevel.Verbose);
      const result = logPrompt('schedule', 'test command', 'instructions', '');

      expect(result).not.toBeNull();
      expect(result?.name).toBe(ComponentName.Debug);

      const props = getDebugProps(result);
      expect(props.title).toMatch(/^SYSTEM PROMPT \(\d+ lines, \d+ bytes\)$/);
      expect(props.color).toBe(Palette.Gray);
      expect(props.content).toContain('Tool: schedule');
      expect(props.content).toContain('Command: test command');
      expect(props.content).toContain('(no skills)');
    });

    it('shows condensed skills summary in debug output', () => {
      setDebugLevel(DebugLevel.Verbose);
      const definitions = [
        {
          key: 'build-project',
          name: 'Build Project',
          description: 'Build the project',
          steps: ['Compile source', 'Bundle assets'],
          execution: ['npm run compile', 'npm run bundle'],
          isValid: true,
        },
      ];

      const result = logPrompt(
        'schedule',
        'build',
        'base instructions',
        '',
        definitions
      );
      const props = getDebugProps(result);

      // Summary mode shows Name, Steps, Execution with proper formatting
      expect(props.content).toContain('Tool: schedule');
      expect(props.content).toContain('Command: build');
      expect(props.content).toContain('## Available Skills');
      expect(props.content).toContain('Build Project');
      expect(props.content).toContain('### Steps');
      expect(props.content).toContain('- Compile source');
      expect(props.content).toContain('### Execution');
      expect(props.content).toContain('- npm run compile');
    });

    it('handles special characters in tool name and command', () => {
      setDebugLevel(DebugLevel.Verbose);
      const result = logPrompt(
        'schedule-tool',
        'test: "command" with quotes',
        'instructions',
        ''
      );

      const props = getDebugProps(result);
      expect(props.content).toContain('Tool: schedule-tool');
      expect(props.content).toContain('Command: test: "command" with quotes');
    });

    it('creates unique component IDs for each call', () => {
      setDebugLevel(DebugLevel.Verbose);
      const result1 = logPrompt('schedule', 'cmd1', 'instr1', '');
      const result2 = logPrompt('schedule', 'cmd2', 'instr2', '');

      expect(result1?.id).toBeDefined();
      expect(result2?.id).toBeDefined();
      expect(result1?.id).not.toBe(result2?.id);
    });
  });

  describe('Logging responses', () => {
    it('returns null when debug level is None', () => {
      setDebugLevel(DebugLevel.None);
      const result = logResponse('schedule', { message: 'test' }, 100);
      expect(result).toBeNull();
    });

    it('returns null when debug level is Info', () => {
      setDebugLevel(DebugLevel.Info);
      const result = logResponse('schedule', { message: 'test' }, 100);
      expect(result).toBeNull();
    });

    it('creates debug component when debug level is Verbose', () => {
      setDebugLevel(DebugLevel.Verbose);
      const response = { message: 'test message', tasks: [] };
      const result = logResponse('schedule', response, 250);

      expect(result).not.toBeNull();
      expect(result?.name).toBe(ComponentName.Debug);

      const props = getDebugProps(result);
      expect(props.title).toMatch(/^LLM RESPONSE \(\d+ ms\)$/);
      expect(props.color).toBe(Palette.LightGray);
      expect(props.content).toContain('Tool: schedule');
      expect(props.content).toContain('"message": "test message"');
    });

    it('includes full response without truncation', () => {
      setDebugLevel(DebugLevel.Verbose);
      const longResponse = {
        message: 'A'.repeat(500),
        tasks: [{ action: 'B'.repeat(500) }],
      };
      const result = logResponse('schedule', longResponse, 300);

      const props = getDebugProps(result);
      // Response should include full JSON stringified content
      const jsonString = JSON.stringify(longResponse, null, 2);
      expect(props.content).toContain(jsonString);
    });

    it('handles complex nested response objects', () => {
      setDebugLevel(DebugLevel.Verbose);
      const response = {
        message: 'test',
        tasks: [
          {
            action: 'do something',
            type: 'execute',
            params: { nested: { data: 'value' } },
          },
        ],
      };
      const result = logResponse('execute', response, 150);

      const props = getDebugProps(result);
      expect(props.content).toContain('"action": "do something"');
      expect(props.content).toContain('"type": "execute"');
    });

    it('handles null response', () => {
      setDebugLevel(DebugLevel.Verbose);

      const nullResult = logResponse('schedule', null, 50);
      const props = getDebugProps(nullResult);
      expect(props.content).toContain('null');
    });

    it('creates unique component IDs for each call', () => {
      setDebugLevel(DebugLevel.Verbose);
      const result1 = logResponse('schedule', { msg: '1' }, 100);
      const result2 = logResponse('schedule', { msg: '2' }, 200);

      expect(result1?.id).toBeDefined();
      expect(result2?.id).toBeDefined();
      expect(result1?.id).not.toBe(result2?.id);
    });
  });

  describe('Real-life scenarios', () => {
    it('logs complete request-response cycle at Verbose level', () => {
      setDebugLevel(DebugLevel.Verbose);

      const prompt = logPrompt(
        'schedule',
        'create a new file',
        'You are the planning component...',
        ''
      );
      const response = logResponse(
        'schedule',
        {
          message: 'Creating the file.',
          tasks: [{ action: 'Create file test.txt', type: 'execute' }],
        },
        180
      );

      expect(prompt).not.toBeNull();
      expect(response).not.toBeNull();
      expect(prompt?.name).toBe(ComponentName.Debug);
      expect(response?.name).toBe(ComponentName.Debug);
    });

    it('suppresses UI components when level is None', () => {
      setDebugLevel(DebugLevel.None);

      const prompt = logPrompt('schedule', 'cmd', 'instr', '');
      const response = logResponse('schedule', { msg: 'test' }, 120);

      expect(prompt).toBeNull();
      expect(response).toBeNull();
    });

    it('changes debug level mid-operation', () => {
      setDebugLevel(DebugLevel.None);
      expect(logPrompt('schedule', 'cmd1', 'instr1', '')).toBeNull();

      setDebugLevel(DebugLevel.Verbose);
      expect(logPrompt('schedule', 'cmd2', 'instr2', '')).not.toBeNull();

      setDebugLevel(DebugLevel.Info);
      expect(logPrompt('schedule', 'cmd3', 'instr3', '')).toBeNull();
    });

    it('logs different tool types with appropriate content', () => {
      setDebugLevel(DebugLevel.Verbose);

      const planPrompt = logPrompt(
        'schedule',
        'list files',
        'Plan instructions',
        ''
      );
      const executePrompt = logPrompt(
        'execute',
        'run command',
        'Execute instructions',
        ''
      );
      const answerPrompt = logPrompt(
        'answer',
        'what is typescript',
        'Answer instructions',
        ''
      );

      const planProps = getDebugProps(planPrompt);
      const executeProps = getDebugProps(executePrompt);
      const answerProps = getDebugProps(answerPrompt);

      expect(planProps.content).toContain('Tool: schedule');
      expect(executeProps.content).toContain('Tool: execute');
      expect(answerProps.content).toContain('Tool: answer');
    });

    it('handles API error responses', () => {
      setDebugLevel(DebugLevel.Verbose);

      const errorResponse = {
        error: {
          type: 'api_error',
          message: 'Rate limit exceeded',
        },
      };

      const result = logResponse('schedule', errorResponse, 400);
      const props = getDebugProps(result);
      expect(props.content).toContain('"error"');
      expect(props.content).toContain('Rate limit exceeded');
    });

    it('logs pipeline with multiple skills and references', () => {
      setDebugLevel(DebugLevel.Verbose);

      const definitions = [
        {
          key: 'run-tests',
          name: 'Run Tests',
          description: 'Execute test suite',
          steps: ['Run unit tests', 'Run integration tests'],
          execution: ['npm test', 'npm run test:integration'],
          isValid: true,
        },
        {
          key: 'deploy-prod',
          name: 'Deploy to Production',
          description: 'Full deployment pipeline',
          steps: ['Run tests first', 'Build application', 'Deploy to server'],
          execution: [
            '[ Run Tests ]',
            'npm run build',
            'kubectl apply -f deploy.yaml',
          ],
          isValid: true,
        },
      ];

      const result = logPrompt(
        'schedule',
        'deploy to production',
        'You are a task scheduler.',
        '',
        definitions
      );
      const props = getDebugProps(result);

      // Verifies multi-skill summary with skill references preserved
      expect(props.content).toContain('Run Tests');
      expect(props.content).toContain('Deploy to Production');
      expect(props.content).toContain('- npm test');
      expect(props.content).toContain('[ Run Tests ]');
      expect(props.content).toContain('kubectl apply');
    });
  });

  describe('Logging warnings', () => {
    beforeEach(() => {
      // Clear warnings before each test
      getWarnings();
    });

    it('does not store warnings when debug level is None', () => {
      setDebugLevel(DebugLevel.None);
      displayWarning('Test warning');
      displayWarning('Test warning with error', new Error('Test error'));

      const warnings = getWarnings();
      expect(warnings).toEqual([]);
    });

    it('stores warnings when debug level is Info', () => {
      setDebugLevel(DebugLevel.Info);
      displayWarning('Test warning');

      const warnings = getWarnings();
      expect(warnings).toEqual(['Test warning']);
    });

    it('stores warnings when debug level is Verbose', () => {
      setDebugLevel(DebugLevel.Verbose);
      displayWarning('Test warning');

      const warnings = getWarnings();
      expect(warnings).toEqual(['Test warning']);
    });

    it('includes error details when provided', () => {
      setDebugLevel(DebugLevel.Info);
      const error = new Error('Something went wrong');
      displayWarning('Failed to process', error);

      const warnings = getWarnings();
      expect(warnings).toEqual(['Failed to process: Something went wrong']);
    });

    it('handles non-Error objects gracefully', () => {
      setDebugLevel(DebugLevel.Info);
      displayWarning('Warning 1', 'string error');
      displayWarning('Warning 2', { message: 'object error' });
      displayWarning('Warning 3', 123);

      const warnings = getWarnings();
      expect(warnings).toEqual(['Warning 1', 'Warning 2', 'Warning 3']);
    });

    it('accumulates multiple warnings', () => {
      setDebugLevel(DebugLevel.Info);
      displayWarning('Warning 1');
      displayWarning('Warning 2');
      displayWarning('Warning 3');

      const warnings = getWarnings();
      expect(warnings).toEqual(['Warning 1', 'Warning 2', 'Warning 3']);
    });

    it('clears warnings after getWarnings is called', () => {
      setDebugLevel(DebugLevel.Info);
      displayWarning('Warning 1');
      displayWarning('Warning 2');

      const firstCall = getWarnings();
      expect(firstCall).toEqual(['Warning 1', 'Warning 2']);

      const secondCall = getWarnings();
      expect(secondCall).toEqual([]);
    });

    it('returns empty array when no warnings', () => {
      setDebugLevel(DebugLevel.Info);
      const warnings = getWarnings();
      expect(warnings).toEqual([]);
    });
  });

  describe('File logging', () => {
    it('does not create log file when debug level is None', () => {
      setDebugLevel(DebugLevel.None);
      logPrompt('schedule', 'test command', 'instructions', '');

      const files = memoryFs.getFiles();
      expect(files.size).toBe(0);
    });

    it('creates log file when debug level is Info', () => {
      setDebugLevel(DebugLevel.Info);
      logPrompt('schedule', 'test command', 'instructions', '');

      const files = memoryFs.getFiles();
      expect(files.size).toBe(1);
    });

    it('creates log file when debug level is Verbose', () => {
      setDebugLevel(DebugLevel.Verbose);
      logPrompt('schedule', 'test command', 'instructions', '');

      const files = memoryFs.getFiles();
      expect(files.size).toBe(1);
    });

    it('creates log file with correct directory structure', () => {
      setDebugLevel(DebugLevel.Info);
      logPrompt('schedule', 'test', 'instr', '');

      const files = memoryFs.getFiles();
      const path = [...files.keys()][0];

      // Path should match: ~/.pls/logs/YYYY-MM-DD/HH:MM:SS.log.md
      // Time separator is : on Unix, - on Windows
      expect(path).toMatch(
        /\.pls\/logs\/\d{4}-\d{2}-\d{2}\/\d{2}[:-]\d{2}[:-]\d{2}\.log\.md$/
      );
    });

    it('logs user command in code block format', () => {
      setDebugLevel(DebugLevel.Info);
      logPrompt('schedule', 'deploy to production', 'instructions', '');

      const files = memoryFs.getFiles();
      const content = [...files.values()][0];

      expect(content).toContain('# User Command');
      expect(content).toContain('```\ndeploy to production\n```');
    });

    it('logs system prompt section', () => {
      setDebugLevel(DebugLevel.Info);
      logPrompt('schedule', 'test', 'You are a planner.', '');

      const files = memoryFs.getFiles();
      const content = [...files.values()][0];

      expect(content).toContain('# System Prompt');
      expect(content).toContain('**Tool:** schedule');
      expect(content).toContain('You are a planner.');
    });

    it('logs LLM response with JSON in code block', () => {
      setDebugLevel(DebugLevel.Info);
      const response = { message: 'Done', tasks: [{ action: 'test' }] };
      logResponse('schedule', response, 150);

      const files = memoryFs.getFiles();
      const content = [...files.values()][0];

      expect(content).toContain('# LLM Response');
      expect(content).toContain('**Tool:** schedule');
      expect(content).toContain('```json');
      expect(content).toContain('"message": "Done"');
      expect(content).toContain('```');
    });

    it('appends multiple entries to same log file', () => {
      setDebugLevel(DebugLevel.Info);
      logPrompt('schedule', 'first command', 'instructions', '');
      logResponse('schedule', { message: 'response' }, 100);

      const files = memoryFs.getFiles();
      expect(files.size).toBe(1);

      const content = [...files.values()][0];
      expect(content).toContain('# User Command');
      expect(content).toContain('# System Prompt');
      expect(content).toContain('# LLM Response');
    });

    it('creates unique filename with -a suffix when file exists', () => {
      setDebugLevel(DebugLevel.Info);

      // First session creates initial file
      logPrompt('schedule', 'first', 'instr', '');
      const firstPath = [...memoryFs.getFiles().keys()][0];

      // Reset session to simulate new run
      resetSessionLog();

      // Second session should create file with -a suffix
      logPrompt('schedule', 'second', 'instr', '');

      const files = memoryFs.getFiles();
      expect(files.size).toBe(2);

      const paths = [...files.keys()];
      const secondPath = paths.find((p) => p !== firstPath);
      expect(secondPath).toMatch(/-a\.log\.md$/);
    });

    it('creates unique filename with -b suffix when -a exists', () => {
      setDebugLevel(DebugLevel.Info);

      // Create first file
      logPrompt('schedule', 'first', 'instr', '');
      resetSessionLog();

      // Create second file (-a)
      logPrompt('schedule', 'second', 'instr', '');
      resetSessionLog();

      // Create third file (-b)
      logPrompt('schedule', 'third', 'instr', '');

      const files = memoryFs.getFiles();
      expect(files.size).toBe(3);

      const paths = [...files.keys()];
      expect(paths.some((p) => p.endsWith('-b.log.md'))).toBe(true);
    });

    it('preserves log content across multiple prompts and responses', () => {
      setDebugLevel(DebugLevel.Info);

      logPrompt('schedule', 'plan task', 'planner instructions', '');
      logResponse('schedule', { message: 'planned', tasks: [] }, 100);
      logPrompt('execute', 'run task', 'executor instructions', '');
      logResponse('execute', { output: 'success' }, 50);

      const content = [...memoryFs.getFiles().values()][0];

      // All entries should be present
      expect(content).toContain('plan task');
      expect(content).toContain('"message": "planned"');
      expect(content).toContain('run task');
      expect(content).toContain('"output": "success"');
    });

    it('uses timestamp fallback when all letter suffixes exhausted', () => {
      setDebugLevel(DebugLevel.Info);

      // Create first session to get the base path
      logPrompt('schedule', 'initial', 'instr', '');
      const basePath = [...memoryFs.getFiles().keys()][0];
      resetSessionLog();

      // Pre-create files for all letter suffixes (a-z) to force fallback
      const ext = '.log.md';
      const baseWithoutExt = basePath.slice(0, -ext.length);
      for (let i = 0; i < 26; i++) {
        const suffix = String.fromCharCode(97 + i); // a-z
        memoryFs.writeFile(`${baseWithoutExt}-${suffix}${ext}`, '');
      }

      // Next session should use millisecond fallback (or fresh timestamp if
      // second boundary crossed)
      logPrompt('schedule', 'fallback', 'instr', '');

      const files = memoryFs.getFiles();
      const paths = [...files.keys()];

      // Should have: base file + 26 letter files + 1 new file = 28
      expect(files.size).toBe(28);

      // Find the new file (not base, not letter-suffixed)
      const letterSuffixPattern = /-[a-z]\.log\.md$/;
      const newFile = paths.find(
        (p) => p !== basePath && !letterSuffixPattern.test(p)
      );
      expect(newFile).toBeDefined();

      // New file is either milliseconds fallback (same second) or fresh
      // timestamp (crossed second boundary) - both are valid
      const msPattern = /-\d{3}\.log\.md$/;
      const freshTimestampPattern = /\d{2}[:-]\d{2}[:-]\d{2}\.log\.md$/;
      expect(
        msPattern.test(newFile!) || freshTimestampPattern.test(newFile!)
      ).toBe(true);
    });

    it('gracefully handles file system errors', () => {
      const failingFs: FileSystem = {
        exists: () => false,
        readFile: () => {
          throw new Error('Read failed');
        },
        writeFile: () => {
          throw new Error('Write failed');
        },
        appendFile: () => {
          throw new Error('Append failed');
        },
        readDirectory: () => [],
        createDirectory: () => {
          throw new Error('Mkdir failed');
        },
        rename: () => {
          throw new Error('Rename failed');
        },
        remove: () => {
          throw new Error('Remove failed');
        },
      };

      setFileSystem(failingFs);
      setDebugLevel(DebugLevel.Info);

      // Should not throw - logging degrades gracefully
      expect(() => {
        logPrompt('schedule', 'test', 'instructions', '');
        logResponse('schedule', { message: 'test' }, 100);
      }).not.toThrow();
    });
  });
});
