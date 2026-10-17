import { Test, TestingModule } from '@nestjs/testing';
import { PingController } from '../../../../src/modules/ping/ping.controller.js';
import { PingService } from '../../../../src/modules/ping/ping.service.js';

describe('PingController', () => {
  let pingController: PingController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PingController],
      providers: [PingService],
    }).compile();

    pingController = module.get<PingController>(PingController);
  });

  it('should return "Pong GEO!"', () => {
    expect(pingController.ping()).toBe('Pong GEO!');
  });
});
