CREATE INDEX `idx_msg_reaction_message` ON `message_reactions` (`messageId`);--> statement-breakpoint
ALTER TABLE `message_reactions` DROP INDEX `uq_msg_reaction`;--> statement-breakpoint
ALTER TABLE `messages` ADD `clientMessageId` varchar(36);--> statement-breakpoint
ALTER TABLE `messages` ADD `replyToMessageId` int;--> statement-breakpoint
ALTER TABLE `messages` ADD `recalledAt` datetime;--> statement-breakpoint
ALTER TABLE `messages` ADD `recalledByUserId` int;--> statement-breakpoint
UPDATE `messages`
JOIN (
  SELECT
    `id`,
    ROW_NUMBER() OVER (PARTITION BY `conversationId` ORDER BY `createdAt`, `id`) AS `nextConversationIndex`
  FROM `messages`
) `ranked_messages` ON `messages`.`id` = `ranked_messages`.`id`
SET `messages`.`conversationIndex` = `ranked_messages`.`nextConversationIndex`;--> statement-breakpoint
UPDATE `conversations`
LEFT JOIN (
  SELECT `conversationId`, MAX(`conversationIndex`) AS `lastIndex`
  FROM `messages`
  GROUP BY `conversationId`
) `message_indexes` ON `conversations`.`id` = `message_indexes`.`conversationId`
SET `conversations`.`lastMessageIndex` = COALESCE(`message_indexes`.`lastIndex`, 0);--> statement-breakpoint
ALTER TABLE `message_reactions` ADD CONSTRAINT `uq_msg_reaction` UNIQUE(`messageId`,`userId`);--> statement-breakpoint
ALTER TABLE `messages` ADD CONSTRAINT `uq_message_client_id` UNIQUE(`senderId`,`clientMessageId`);--> statement-breakpoint
ALTER TABLE `messages` ADD CONSTRAINT `uq_message_conversation_index` UNIQUE(`conversationId`,`conversationIndex`);--> statement-breakpoint
ALTER TABLE `messages` ADD CONSTRAINT `messages_recalledByUserId_users_id_fk` FOREIGN KEY (`recalledByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_message_conversation_index` ON `messages` (`conversationId`,`conversationIndex`);--> statement-breakpoint
CREATE INDEX `idx_message_reply_to` ON `messages` (`replyToMessageId`);
