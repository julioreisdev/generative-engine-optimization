import { Test } from '@nestjs/testing';
import { PingAiController } from '../../../../src/modules/ping-ai/ping-ai.controller.js';
import { PingAiService } from '../../../../src/modules/ping-ai/ping-ai.service.js';

describe('PingAiController', () => {
  const response = {
    message: 'Oi!',
    startedAt: '2026-10-18T12:00:00.000Z',
    totalTimeMs: 5000,
    results: [],
  };
  const pingAiService = { run: vi.fn().mockResolvedValue(response) };
  let controller: PingAiController;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [PingAiController],
      providers: [{ provide: PingAiService, useValue: pingAiService }],
    }).compile();
    controller = module.get(PingAiController);
  });

  it('should pass the message from the query to the service', async () => {
    await expect(controller.ping({ message: 'Tudo bem?' })).resolves.toBe(
      response,
    );
    expect(pingAiService.run).toHaveBeenCalledWith('Tudo bem?');
  });

  it('should let the service use the default message when none is given', async () => {
    await controller.ping({});

    expect(pingAiService.run).toHaveBeenCalledWith(undefined);
  });
});
