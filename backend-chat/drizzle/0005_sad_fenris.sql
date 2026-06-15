ALTER TABLE `messages` ADD `fileThumbnailUrl` text;--> statement-breakpoint
ALTER TABLE `messages` ADD `fileDurationSeconds` int;--> statement-breakpoint
ALTER TABLE `messages` ADD `callSessionId` int;--> statement-breakpoint
ALTER TABLE `messages` ADD CONSTRAINT `messages_callSessionId_call_sessions_id_fk` FOREIGN KEY (`callSessionId`) REFERENCES `call_sessions`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_message_call_session` ON `messages` (`callSessionId`);