DROP INDEX `key_backup_reference_key`;--> statement-breakpoint
CREATE INDEX `key_backup_reference_key` ON `key_backup_references` (`purpose`,`key_id`,`key_version`,`backup_id`);--> statement-breakpoint
DROP INDEX `protected_record_key`;--> statement-breakpoint
CREATE INDEX `protected_record_key` ON `protected_records` (`purpose`,`key_id`,`key_version`,`id`);--> statement-breakpoint
CREATE INDEX `key_active_versions` ON `key_versions` (`purpose`,`key_id`,`version`) WHERE "key_versions"."state" != 'removed';