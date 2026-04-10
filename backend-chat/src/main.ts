import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { AuthIoAdapter } from './chat/redis-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const authIoAdapter = new AuthIoAdapter(app);
  app.useWebSocketAdapter(authIoAdapter);

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  app.enableCors();
  await app.listen(3000);
  console.log(`Application is running on: ${await app.getUrl()}`)
}
bootstrap();