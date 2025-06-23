import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { KetersediaanService } from './ketersediaan.service';
import {
  CreateKetersediaanDto,
  CreateKetersediaanSchema,
} from './dto/create-ketersediaan.dto';
import {
  UpdateKetersediaanDto,
  UpdateKetersediaanSchema,
} from './dto/update-ketersediaan.dto';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';

@Controller('ketersediaan')
export class KetersediaanController {
  constructor(private readonly ketersediaanService: KetersediaanService) {}

  @Post()
  create(
    @Body(new ZodValidationPipe(CreateKetersediaanSchema))
    createKetersediaanDto: CreateKetersediaanDto,
  ) {
    return this.ketersediaanService.create(createKetersediaanDto);
  }

  @Get()
  findAll() {
    return this.ketersediaanService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ketersediaanService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateKetersediaanSchema))
    updateKetersediaanDto: UpdateKetersediaanDto,
  ) {
    return this.ketersediaanService.update(id, updateKetersediaanDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.ketersediaanService.remove(id);
  }
}
