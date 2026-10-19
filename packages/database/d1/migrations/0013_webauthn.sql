CREATE TABLE `passkey_credentials` (
	`id` text PRIMARY KEY NOT NULL,
	`identity_id` text NOT NULL,
	`public_key` text NOT NULL,
	`counter` integer NOT NULL,
	`transports` text,
	`device_type` text NOT NULL,
	`backed_up` integer NOT NULL,
	`aaguid` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_used_at` integer,
	FOREIGN KEY (`identity_id`) REFERENCES `identities`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "passkey_id_bound" CHECK(length("passkey_credentials"."id") BETWEEN 1 AND 1024),
	CONSTRAINT "passkey_public_key_bound" CHECK(length("passkey_credentials"."public_key") BETWEEN 1 AND 4096),
	CONSTRAINT "passkey_counter" CHECK("passkey_credentials"."counter" BETWEEN 0 AND 2147483647),
	CONSTRAINT "passkey_device_type" CHECK("passkey_credentials"."device_type" IN ('singleDevice', 'multiDevice')),
	CONSTRAINT "passkey_backed_up" CHECK("passkey_credentials"."backed_up" IN (0, 1)),
	CONSTRAINT "passkey_aaguid_bound" CHECK(length("passkey_credentials"."aaguid") = 36),
	CONSTRAINT "passkey_created" CHECK("passkey_credentials"."created_at" BETWEEN 0 AND 8640000000000000),
	CONSTRAINT "passkey_last_used" CHECK("passkey_credentials"."last_used_at" IS NULL OR ("passkey_credentials"."last_used_at" BETWEEN 0 AND 8640000000000000 AND "passkey_credentials"."last_used_at" >= "passkey_credentials"."created_at"))
);
--> statement-breakpoint
CREATE INDEX `passkey_identity` ON `passkey_credentials` (`identity_id`);
--> statement-breakpoint
CREATE TABLE `webauthn_challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`challenge` text NOT NULL,
	`identity_id` text,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`consumed_at` integer,
	CONSTRAINT "webauthn_challenge_kind" CHECK("webauthn_challenges"."kind" IN ('registration', 'authentication')),
	CONSTRAINT "webauthn_challenge_value" CHECK(length("webauthn_challenges"."challenge") BETWEEN 16 AND 256),
	CONSTRAINT "webauthn_challenge_time" CHECK("webauthn_challenges"."expires_at" > "webauthn_challenges"."created_at" AND "webauthn_challenges"."expires_at" BETWEEN 0 AND 8640000000000000 AND ("webauthn_challenges"."consumed_at" IS NULL OR "webauthn_challenges"."consumed_at" >= "webauthn_challenges"."created_at"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `webauthn_challenge_value` ON `webauthn_challenges` (`challenge`);
--> statement-breakpoint
CREATE INDEX `webauthn_challenge_expiry` ON `webauthn_challenges` (`expires_at`);