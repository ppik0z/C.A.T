import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { DrizzleService } from '../database/drizzle.service';
import { AuthService } from './auth.service';
import { AuthSessionService } from './auth-session.service';
import { PasswordHasherService } from './password-hasher.service';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: DrizzleService,
          useValue: { db: {} },
        },
        {
          provide: JwtService,
          useValue: { signAsync: jest.fn(), verifyAsync: jest.fn() },
        },
        {
          provide: AuthSessionService,
          useValue: { create: jest.fn(), rotate: jest.fn(), revokeSerialized: jest.fn(), revokeAllForUser: jest.fn() },
        },
        {
          provide: PasswordHasherService,
          useValue: { hash: jest.fn(), verify: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
