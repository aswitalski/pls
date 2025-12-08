import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AnthropicService,
  ComprehensionStatus,
} from '../../src/services/anthropic.js';

interface MockableAnthropicService {
  client: {
    messages: {
      create: ReturnType<typeof vi.fn>;
    };
  };
}

describe('COMPREHEND and PLAN flow', () => {
  let service: AnthropicService;
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Mock the Anthropic client
    mockCreate = vi.fn();
    service = new AnthropicService('test-key');
    (service as unknown as MockableAnthropicService).client = {
      messages: {
        create: mockCreate,
      },
    };
  });

  describe('Unknown verbs handling', () => {
    it('creates ignore tasks for unknown verbs', async () => {
      // Step 1: Mock COMPREHEND response
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'tool_use',
            input: {
              message: 'Understanding your request.',
              items: [
                {
                  verb: 'build',
                  name: 'Build Application',
                  status: ComprehensionStatus.Custom,
                },
                {
                  verb: 'test',
                  status: ComprehensionStatus.Unknown,
                },
              ],
              isInformationRequest: false,
              isIntrospectionRequest: false,
            },
          },
        ],
        stop_reason: 'end_turn',
      });

      // Call COMPREHEND
      const comprehendResult = await service.processWithTool(
        'build and test opera',
        'comprehend'
      );

      expect(comprehendResult.comprehension).toBeDefined();
      expect(comprehendResult.comprehension?.items).toHaveLength(2);
      expect(comprehendResult.comprehension?.items[0]).toMatchObject({
        verb: 'build',
        name: 'Build Application',
        status: ComprehensionStatus.Custom,
      });
      expect(comprehendResult.comprehension?.items[1]).toMatchObject({
        verb: 'test',
        status: ComprehensionStatus.Unknown,
      });

      // Step 2: Mock PLAN response
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'tool_use',
            input: {
              message: 'Here is my plan.',
              tasks: [
                {
                  action: 'Build the opera application',
                  type: 'execute',
                  params: { skill: 'Build Application' },
                },
                {
                  action: "Ignore unknown 'test' request",
                  type: 'ignore',
                },
              ],
            },
          },
        ],
        stop_reason: 'end_turn',
      });

      // Call PLAN with comprehension results
      const planResult = await service.processWithTool(
        'build and test opera',
        'plan',
        comprehendResult.comprehension
      );

      // Verify PLAN created both tasks
      expect(planResult.tasks).toHaveLength(2);
      expect(planResult.tasks[0]).toMatchObject({
        action: 'Build the opera application',
        type: 'execute',
      });
      expect(planResult.tasks[1]).toMatchObject({
        action: "Ignore unknown 'test' request",
        type: 'ignore',
      });

      // Verify comprehension results were passed to PLAN
      const planCall = mockCreate.mock.calls[1];
      const planCallArgs = planCall[0] as { system: string };
      expect(planCallArgs.system).toContain('Comprehension Results');
      expect(planCallArgs.system).toContain('"verb": "test"');
      expect(planCallArgs.system).toContain('"status": "unknown"');
    });

    it('creates ignore task for single unknown verb', async () => {
      // Step 1: Mock COMPREHEND response for "test" with no test skill
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'tool_use',
            input: {
              message: 'Analyzing available options.',
              items: [
                {
                  verb: 'test',
                  status: ComprehensionStatus.Unknown,
                },
              ],
              isInformationRequest: false,
              isIntrospectionRequest: false,
            },
          },
        ],
        stop_reason: 'end_turn',
      });

      // Call COMPREHEND
      const comprehendResult = await service.processWithTool(
        'test opera',
        'comprehend'
      );

      expect(comprehendResult.comprehension?.items).toHaveLength(1);
      expect(comprehendResult.comprehension?.items[0].status).toBe(
        ComprehensionStatus.Unknown
      );

      // Step 2: Mock PLAN response
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'tool_use',
            input: {
              message: 'Here is my plan.',
              tasks: [
                {
                  action: "Ignore unknown 'test' request",
                  type: 'ignore',
                },
              ],
            },
          },
        ],
        stop_reason: 'end_turn',
      });

      // Call PLAN with comprehension results
      const planResult = await service.processWithTool(
        'test opera',
        'plan',
        comprehendResult.comprehension
      );

      // Verify PLAN created ignore task
      expect(planResult.tasks).toHaveLength(1);
      expect(planResult.tasks[0]).toMatchObject({
        action: "Ignore unknown 'test' request",
        type: 'ignore',
      });
    });

    it('preserves comprehension status through the flow', async () => {
      // Mock COMPREHEND
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'tool_use',
            input: {
              message: 'Checking what I can do.',
              items: [
                {
                  verb: 'deploy',
                  name: 'Deploy Application',
                  status: ComprehensionStatus.Custom,
                },
                {
                  verb: 'validate',
                  status: ComprehensionStatus.Unknown,
                },
                {
                  verb: 'notify',
                  status: ComprehensionStatus.Unknown,
                },
              ],
              isInformationRequest: false,
              isIntrospectionRequest: false,
            },
          },
        ],
        stop_reason: 'end_turn',
      });

      const comprehendResult = await service.processWithTool(
        'deploy, validate, and notify',
        'comprehend'
      );

      // Mock PLAN
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'tool_use',
            input: {
              message: 'Here is my plan.',
              tasks: [
                {
                  action: 'Deploy the application to staging',
                  type: 'execute',
                  params: {
                    skill: 'Deploy Application',
                    environment: 'staging',
                  },
                },
                {
                  action: "Ignore unknown 'validate' request",
                  type: 'ignore',
                },
                {
                  action: "Ignore unknown 'notify' request",
                  type: 'ignore',
                },
              ],
            },
          },
        ],
        stop_reason: 'end_turn',
      });

      const planResult = await service.processWithTool(
        'deploy, validate, and notify',
        'plan',
        comprehendResult.comprehension
      );

      // Verify all three tasks are present
      expect(planResult.tasks).toHaveLength(3);
      expect(planResult.tasks[0].type).toBe('execute');
      expect(planResult.tasks[1].type).toBe('ignore');
      expect(planResult.tasks[2].type).toBe('ignore');
    });
  });

  describe('Core tools handling', () => {
    it('identifies core tools correctly', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'tool_use',
            input: {
              message: 'Understanding your request.',
              items: [
                {
                  verb: 'explain',
                  name: 'Answer',
                  status: ComprehensionStatus.Core,
                },
              ],
              isInformationRequest: true,
              isIntrospectionRequest: false,
            },
          },
        ],
        stop_reason: 'end_turn',
      });

      const result = await service.processWithTool(
        'explain typescript',
        'comprehend'
      );

      expect(result.comprehension?.items[0]).toEqual({
        verb: 'explain',
        name: 'Answer',
        status: ComprehensionStatus.Core,
      });
      expect(result.comprehension?.isInformationRequest).toBe(true);
    });
  });
});
