import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../types';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  private reflectorInstance: Reflector;

  constructor(reflector?: Reflector) {
    this.reflectorInstance = reflector || new Reflector();
  }

  canActivate(context: ExecutionContext): boolean {
    const reflector = this.reflectorInstance || new Reflector();
    const requiredRoles = reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user || !user.role) {
      // If no user is attached to request yet (unauthenticated or public route without user)
      return true;
    }

    const hasRole = requiredRoles.includes(user.role as Role);
    if (!hasRole) {
      throw new ForbiddenException(`ليس لديك الصلاحية المطلوبـة: [${requiredRoles.join(', ')}]`);
    }

    return true;
  }
}
