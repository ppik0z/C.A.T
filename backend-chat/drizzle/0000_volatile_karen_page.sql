CREATE TABLE `auth_sessions` (
  `id` varchar(36) NOT NULL,
  `userId` int NOT NULL,
  `refreshTokenHash` varchar(64) NOT NULL,
  `userAgent` varchar(255),
  `expiresAt` datetime NOT NULL,
  `lastUsedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `revokedAt` datetime,
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `auth_sessions_id` PRIMARY KEY(`id`),
  CONSTRAINT `auth_sessions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX `idx_auth_sessions_user` ON `auth_sessions` (`userId`);
--> statement-breakpoint
CREATE INDEX `idx_auth_sessions_expiry` ON `auth_sessions` (`expiresAt`);
