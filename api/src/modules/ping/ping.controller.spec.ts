import { Test, TestingModule } from '@nestjs/testing';
import { PingController } from './ping.controller.js';
import { PingService } from './ping.service.js';

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
