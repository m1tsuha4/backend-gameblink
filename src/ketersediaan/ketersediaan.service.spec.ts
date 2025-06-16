import { Test, TestingModule } from '@nestjs/testing';
import { KetersediaanService } from './ketersediaan.service';

describe('KetersediaanService', () => {
  let service: KetersediaanService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [KetersediaanService],
    }).compile();

    service = module.get<KetersediaanService>(KetersediaanService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
