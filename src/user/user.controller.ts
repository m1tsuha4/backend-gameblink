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
import { UserService } from './user.service';
import { CreateUserDto, CreateUserSchema } from './dto/create-user.dto';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import { UpdateUserDto, UpdateUserSchema } from './dto/update-user.dto';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from 'src/auth/guard/jwt-guard.auth';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/roles.guard';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  register(@Body(new ZodValidationPipe(CreateUserSchema)) dto: CreateUserDto) {
    return this.userService.createUser(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  findAll() {
    return this.userService.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  findOne(@Param('id') id: string) {
    return this.userService.findById(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateUserSchema)) updateUserDto: UpdateUserDto,
  ) {
    return this.userService.updateUser(id, updateUserDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.userService.deleteUser(id);
  }
}
