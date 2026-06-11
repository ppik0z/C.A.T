CREATE TABLE `auth_action_tokens` (
	`id` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`purpose` varchar(32) NOT NULL,
	`tokenHash` varchar(64) NOT NULL,
	`targetEmail` varchar(255) NOT NULL,
	`expiresAt` datetime NOT NULL,
	`consumedAt` datetime,
	`createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `auth_action_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_auth_action_token_hash` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `uq_users_email` UNIQUE(`email`);--> statement-breakpoint
ALTER TABLE `auth_action_tokens` ADD CONSTRAINT `auth_action_tokens_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_auth_action_token_user_purpose` ON `auth_action_tokens` (`userId`,`purpose`);--> statement-breakpoint
CREATE INDEX `idx_auth_action_token_expiry` ON `auth_action_tokens` (`expiresAt`);