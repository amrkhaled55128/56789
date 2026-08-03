import { Injectable, UnauthorizedException, ForbiddenException, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import * as argon2 from 'argon2';

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(JwtService) private jwtService: JwtService,
  ) {}

  async validateUser(username: string, pass: string) {
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('اسم المستخدم غير صحيح أو الحساب معطل');
    }
    const isMatch = await argon2.verify(user.passwordHash, pass);
    if (!isMatch) {
      throw new UnauthorizedException('كلمة المرور غير صحيحة');
    }
    return user;
  }

  async login(username: string, pass: string) {
    const user = await this.validateUser(username, pass);
    const payload = { sub: user.id, username: user.username, role: user.role, fullName: user.fullName };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });
    const tokenHash = await argon2.hash(refreshToken);

    await this.prisma.refreshToken.create({
      data: {
        tokenHash,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
      },
    };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken);
      const userTokens = await this.prisma.refreshToken.findMany({
        where: { userId: payload.sub, revokedAt: null },
      });

      let validToken = false;
      for (const t of userTokens) {
        if (await argon2.verify(t.tokenHash, refreshToken)) {
          validToken = true;
          break;
        }
      }

      if (!validToken) {
        throw new UnauthorizedException('رمز التنشيط غير صالح أو تم إبطاله');
      }

      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user || !user.isActive) {
        throw new ForbiddenException('الحساب غير نشط');
      }

      const newPayload = { sub: user.id, username: user.username, role: user.role, fullName: user.fullName };
      const newAccessToken = this.jwtService.sign(newPayload, { expiresIn: '15m' });

      return { accessToken: newAccessToken };
    } catch (err) {
      throw new UnauthorizedException('فشل تجديد الجلسة');
    }
  }

  async logout(userId?: string) {
    if (userId) {
      await this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return { message: 'تم تسجيل الخروج بنجاح' };
  }
}
