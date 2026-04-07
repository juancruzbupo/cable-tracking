import {
  Controller, Post, Get, Patch, Param, Body, Request, Req, Res,
  ForbiddenException, NotFoundException, UnauthorizedException, Logger,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request as ExpressRequest, Response } from 'express';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { AuditService } from '../../common/audit/audit.service';
import { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { Public } from './public.decorator';
import { Roles } from './roles.decorator';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 8 * 60 * 60 * 1000,
  path: '/',
};

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly audit: AuditService,
  ) {}

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const result = await this.authService.login(dto.email, dto.password);
      // Set httpOnly cookie
      res.cookie('access_token', result.accessToken, COOKIE_OPTIONS);
      // Log successful login
      this.audit.log(result.user.id, 'LOGIN_SUCCESS', 'AUTH', result.user.id, {
        email: dto.email, ip: req.ip,
      }).catch(() => {});
      return result;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        this.logger.warn(`Login failed for ${dto.email} from ${req.ip}`);
        // Log failed attempt using any admin user as audit actor
        const admin = await this.usersService.findFirstAdmin();
        if (admin) {
          this.audit.log(admin.id, 'LOGIN_FAILED', 'AUTH', 'login', {
            email: dto.email, ip: req.ip, userAgent: req.headers['user-agent'],
          }).catch(() => {});
        }
      }
      throw error;
    }
  }

  @Post('refresh')
  @Roles('ADMIN', 'OPERADOR', 'VISOR')
  async refresh(
    @Request() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.refresh(req.user.id);
    res.cookie('access_token', result.accessToken, COOKIE_OPTIONS);
    return result;
  }

  @Post('logout')
  @Roles('ADMIN', 'OPERADOR', 'VISOR')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('access_token', { path: '/' });
    return { ok: true };
  }

  @Get('me')
  @Roles('ADMIN', 'OPERADOR', 'VISOR')
  me(@Request() req: AuthenticatedRequest) {
    return req.user;
  }

  @Post('change-password')
  async changePassword(@Request() req: AuthenticatedRequest, @Body() dto: ChangePasswordDto) {
    const user = await this.usersService.findByEmailWithPassword(req.user.email);
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
  async createUser(@Body() dto: CreateUserDto, @Request() req: AuthenticatedRequest) {
    const user = await this.usersService.create(dto);
    await this.audit.log(req.user.id, 'USER_CREATED', 'USER', user.id, { email: dto.email, role: dto.role });
    return user;
  }

  @Patch('users/:id')
  @Roles('ADMIN')
  async updateUser(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @Request() req: AuthenticatedRequest,
  ) {
    if (id === req.user.id && (dto.role || dto.isActive === false)) {
      throw new ForbiddenException('No podés modificar tu propio rol o desactivar tu cuenta');
    }
    const user = await this.usersService.findById(id);
    if (!user) throw new NotFoundException('Usuario no encontrado');
    const updated = await this.usersService.update(id, dto);
    await this.audit.log(req.user.id, 'USER_UPDATED', 'USER', id, dto);
    return updated;
  }
}
