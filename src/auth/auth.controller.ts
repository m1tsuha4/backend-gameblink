import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { LoginDto, LoginSchema } from './dto/login.dto';
import { User } from '../common/decorators/user.decorator';
import { JwtAuthGuard } from './guard/jwt-guard.auth';
import { UserService } from 'src/user/user.service';
import { CreateUserDto, CreateUserSchema } from 'src/user/dto/create-user.dto';
import { UpdateUserDto, UpdateUserSchema } from 'src/user/dto/update-user.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
  ) {}

  @Post('register')
  register(@Body(new ZodValidationPipe(CreateUserSchema)) dto: CreateUserDto) {
    return this.userService.createUser(dto);
  }

  @Post('login')
  async login(@Body(new ZodValidationPipe(LoginSchema)) loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@User() user) {
    return user;
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  async updateUser(
    @User() user,
    @Body(new ZodValidationPipe(UpdateUserSchema)) dto: UpdateUserDto,
  ) {
    return this.userService.updateUser(user.id, dto);
  }
}
