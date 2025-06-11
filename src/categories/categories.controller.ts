import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import {
  CreateCategoryDto,
  CreateCategorySchema,
} from './dto/create-category.dto';
import { JwtAuthGuard } from 'src/auth/guard/jwt-guard.auth';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @ApiResponse({ status: 200, description: 'List of articles' })
  findAll() {
    return this.categoriesService.findAll();
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.categoriesService.findBySlug(slug);
  }

  @Get(':slug/articles')
  findArticlesByCategory(@Param('slug') slug: string) {
    return this.categoriesService.findArticlesByCategory(slug);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post()
  create(
    @Body(new ZodValidationPipe(CreateCategorySchema))
    createCategoryDto: CreateCategoryDto,
  ) {
    return this.categoriesService.create(createCategoryDto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(CreateCategorySchema))
    updateCategoryDto: CreateCategoryDto,
  ) {
    return this.categoriesService.update(id, updateCategoryDto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.categoriesService.remove(id);
  }
}
