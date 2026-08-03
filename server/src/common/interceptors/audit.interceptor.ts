import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const method = req.method;

    if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
      const user = req.user;
      const url = req.url;
      const body = req.body;
      const ip = req.ip || req.connection.remoteAddress;

      return next.handle().pipe(
        tap(async (response) => {
          try {
            const entity = url.split('/')[2] || 'general';
            const entityId = response?.data?.id || response?.id || req.params?.id || null;

            await this.prisma.auditLog.create({
              data: {
                userId: user?.id || null,
                action: method,
                entity: entity.toUpperCase(),
                entityId: entityId ? String(entityId) : null,
                afterValue: JSON.stringify(body),
                ipAddress: String(ip),
              },
            });
          } catch (err) {
            console.error('Failed to create audit log entry', err);
          }
        }),
      );
    }

    return next.handle();
  }
}
