import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly reflectorInstance: Reflector;
  private readonly jwtInstance: JwtService;

  constructor(
    reflector?: Reflector,
    jwtService?: JwtService,
  ) {
    this.reflectorInstance = reflector || new Reflector();
    this.jwtInstance = jwtService || new JwtService({ secret: process.env.JWT_SECRET || 'vet_clinic_super_secret_jwt_key_2026' });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const reflector = this.reflectorInstance || new Reflector();
    let isPublic = false;
    try {
      isPublic = !!reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
    } catch (e) {
      isPublic = false;
    }

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers?.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('يرجى تسجيل الدخول للوصول إلى هذا الإجراء');
    }

    const token = authHeader.split(' ')[1];
    try {
      const jwtService = this.jwtInstance || new JwtService({ secret: process.env.JWT_SECRET || 'vet_clinic_super_secret_jwt_key_2026' });
      const payload = await jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET || 'vet_clinic_super_secret_jwt_key_2026',
      });
      request.user = {
        id: payload.sub,
        username: payload.username,
        role: payload.role,
        fullName: payload.fullName,
      };
      return true;
    } catch (err) {
      throw new UnauthorizedException('انتهت الجلسة أو رمز الوصول غير صالح');
    }
  }
}
