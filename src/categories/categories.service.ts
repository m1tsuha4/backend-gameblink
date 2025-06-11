import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { slugify } from 'src/common/utils/slugify';

@Injectable()
export class CategoriesService {
  constructor(private prismaService: PrismaService) {}

  async create(dto: CreateCategoryDto) {
    const existing = await this.prismaService.category.findUnique({
      where: {
        name: dto.name,
      },
    });
    if (existing) {
      throw new ConflictException('Category name already in use');
    }
    return this.prismaService.category.create({
      data: {
        name: dto.name,
        slug: slugify(dto.name),
      },
    });
  }

  async findAll() {
    const categories = await this.prismaService.category.findMany({
      orderBy: { name: 'asc' },
    });

    if (categories.length === 0)
      throw new NotFoundException('Categories not found');

    return categories;
  }

  async findBySlug(slug: string) {
    const category = await this.prismaService.category.findUnique({
      where: {
        slug,
      },
    });

    if (!category) throw new NotFoundException('Category not found');

    return category;
  }

  async findArticlesByCategory(slug: string) {
    const category = await this.prismaService.category.findUnique({
      where: {
        slug,
      },
      include: {
        articles: {
          include: {
            tags: {
              select: { name: true },
            },
            author: {
              select: { email: true, name: true },
            },
          },
        },
      },
    });
    if (!category) throw new NotFoundException('Category not found');
    if (category.articles.length === 0)
      throw new NotFoundException('Articles not found');
    return category;
  }

  async findOne(id: string) {
    const category = await this.prismaService.category.findUnique({
      where: { id },
    });

    if (!category) {
      throw new ConflictException('Category not found');
    }

    return category;
  }

  async update(id: string, dto: CreateCategoryDto) {
    const existing = await this.prismaService.category.findUnique({
      where: {
        name: dto.name,
      },
    });
    if (existing && existing.id !== id) {
      throw new ConflictException('Category name already in use');
    }
    return this.prismaService.category.update({
      where: { id },
      data: {
        name: dto.name,
      },
    });
  }

  async remove(id: string) {
    const notFound = await this.prismaService.category.findUnique({
      where: { id },
    });
    if (!notFound) {
      throw new ConflictException('Category not found');
    }
    return this.prismaService.category.delete({
      where: { id },
    });
  }
}
