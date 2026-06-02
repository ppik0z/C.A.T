CREATE TABLE `push_subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`authSessionId` varchar(36) NOT NULL,
	`installationId` varchar(36) NOT NULL,
	`provider` varchar(20) NOT NULL DEFAULT 'fcm',
	`token` text,
	`endpoint` text,
	`p256dh` text,
	`auth` text,
	`subscriptionHash` varchar(64) NOT NULL,
	`userAgent` varchar(255),
	`lastSeenAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`revokedAt` datetime,
	`createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `push_subscriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_push_subscription_hash` UNIQUE(`subscriptionHash`)
);
--> statement-breakpoint
ALTER TABLE `user_settings` ADD `showNotificationPreview` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `push_subscriptions` ADD CONSTRAINT `push_subscriptions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `push_subscriptions` ADD CONSTRAINT `push_subscriptions_authSessionId_auth_sessions_id_fk` FOREIGN KEY (`authSessionId`) REFERENCES `auth_sessions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_push_subscription_user_active` ON `push_subscriptions` (`userId`,`revokedAt`);--> statement-breakpoint
CREATE INDEX `idx_push_subscription_session` ON `push_subscriptions` (`authSessionId`);