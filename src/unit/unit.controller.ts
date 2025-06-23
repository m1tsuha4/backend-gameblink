import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { UnitService } from './unit.service';
import { CreateUnitDto, CreateUnitSchema } from './dto/create-unit.dto';
import { UpdateUnitDto, UpdateUnitSchema } from './dto/update-unit.dto';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';

@Controller('unit')
export class UnitController {
  constructor(private readonly unitService: UnitService) {}

  @Post()
  create(
    @Body(new ZodValidationPipe(CreateUnitSchema)) createUnitDto: CreateUnitDto,
  ) {
    return this.unitService.create(createUnitDto);
  }

  @Get('cabang/:cabang_id')
  findAllByCabang(@Param('cabang_id') cabang_id: string) {
    return this.unitService.findAllByCabang(cabang_id);
  }

  @Get()
  findAll() {
    return this.unitService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.unitService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateUnitSchema)) updateUnitDto: UpdateUnitDto,
  ) {
    return this.unitService.update(id, updateUnitDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.unitService.remove(id);
  }
}
