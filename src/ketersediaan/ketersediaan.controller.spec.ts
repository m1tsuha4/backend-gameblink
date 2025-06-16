import { Test, TestingModule } from '@nestjs/testing';
import { KetersediaanController } from './ketersediaan.controller';
import { KetersediaanService } from './ketersediaan.service';

describe('KetersediaanController', () => {
  let controller: KetersediaanController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [KetersediaanController],
      providers: [KetersediaanService],
    }).compile();

    controller = module.get<KetersediaanController>(KetersediaanController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
