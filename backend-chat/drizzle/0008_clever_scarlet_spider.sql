CREATE TABLE `message_mentions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`messageId` int NOT NULL,
	`conversationId` int NOT NULL,
	`mentionedUserId` int NOT NULL,
	`mentionType` varchar(20) NOT NULL DEFAULT 'user',
	`createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `message_mentions_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_message_mention` UNIQUE(`messageId`,`mentionedUserId`)
);
--> statement-breakpoint
ALTER TABLE `message_mentions` ADD CONSTRAINT `message_mentions_messageId_messages_id_fk` FOREIGN KEY (`messageId`) REFERENCES `messages`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `message_mentions` ADD CONSTRAINT `message_mentions_conversationId_conversations_id_fk` FOREIGN KEY (`conversationId`) REFERENCES `conversations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `message_mentions` ADD CONSTRAINT `message_mentions_mentionedUserId_users_id_fk` FOREIGN KEY (`mentionedUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_mention_user_conversation` ON `message_mentions` (`mentionedUserId`,`conversationId`);