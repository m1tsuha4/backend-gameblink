import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UploadedFile,
  UseGuards,
} from '@nestjs/common';
import { CabangService } from './cabang.service';
import { CreateCabangDto, CreateCabangSchema } from './dto/create-cabang.dto';
import { UpdateCabangDto } from './dto/update-cabang.dto';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import { ApiBody, ApiConsumes, ApiProperty } from '@nestjs/swagger';
import { UploadImageInterceptor } from 'src/common/interceptors/multer-config.interceptors';
import { ApiFile } from 'src/common/decorators/apifile.decorator';
import { JwtAuthGuard } from 'src/auth/guard/jwt-guard.auth';
import { RolesGuard } from 'src/common/guards/roles.guard';

@Controller('cabang')
export class CabangController {
  constructor(private readonly cabangService: CabangService) {}

  // @UseGuards(JwtAuthGuard, RolesGuard)
  @Post()
  @ApiConsumes('multipart/form-data')
  @UploadImageInterceptor('cabang')
  async create(
    @UploadedFile() imageCabang: Express.Multer.File,
    @Body(new ZodValidationPipe(CreateCabangSchema)) createCabangDto: CreateCabangDto,
  ) {
    console.log(imageCabang)
    if (imageCabang) {
      createCabangDto.imageCabang = imageCabang.filename;
    }
    return this.cabangService.create(createCabangDto);
  }
  @Get()
  findAll() {
    return this.cabangService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.cabangService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCabangDto: UpdateCabangDto) {
    return this.cabangService.update(id, updateCabangDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.cabangService.remove(id);
  }
}
