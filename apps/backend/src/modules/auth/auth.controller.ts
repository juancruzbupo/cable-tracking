import {
  Controller, Post, Get, Patch, Param, Body, Request,
  ForbiddenException, NotFoundException, UnauthorizedException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { Public } from './public.decorator';
import { Roles } from './roles.decorator';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Get('me')
  me(@Request() req: any) {
    return req.user;
  }

  @Post('change-password')
  async changePassword(@Request() req: any, @Body() dto: ChangePasswordDto) {
    const user = await this.usersService.findByEmail(req.user.email);
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const valid = await this.usersService.validatePassword(dto.currentPassword, user.password);
    if (!valid) throw new UnauthorizedException('Contraseña actual incorrecta');

    await this.usersService.changePassword(user.id, dto.newPassword);
    return { message: 'Contraseña actualizada' };
  }

  // ── User Management (ADMIN only) ──

  @Get('users')
  @Roles('ADMIN')
  getUsers() {
    return this.usersService.findAll();
  }

  @Post('users')
  @Roles('ADMIN')
  createUser(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Patch('users/:id')
  @Roles('ADMIN')
  async updateUser(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @Request() req: any,
  ) {
    if (id === req.user.id && (dto.role || dto.isActive === false)) {
      throw new ForbiddenException('No podés modificar tu propio rol o desactivar tu cuenta');
    }
    const user = await this.usersService.findById(id);
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return this.usersService.update(id, dto);
  }
}
