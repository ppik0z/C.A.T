ALTER TABLE `auth_sessions` ADD `previousRefreshTokenHash` varchar(64);--> statement-breakpoint
ALTER TABLE `auth_sessions` ADD `rotatedAt` datetime;