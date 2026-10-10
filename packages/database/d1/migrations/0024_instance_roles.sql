CREATE TABLE `instance_roles` (
	`principal_id` text PRIMARY KEY NOT NULL,
	`role` text DEFAULT 'instance-administrator' NOT NULL,
	`granted_at` integer NOT NULL,
	`granted_by` text,
	FOREIGN KEY (`principal_id`) REFERENCES `principals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`granted_by`) REFERENCES `principals`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "instance_role_value" CHECK("instance_roles"."role" = 'instance-administrator'),
	CONSTRAINT "instance_role_no_self_grant" CHECK("instance_roles"."granted_by" IS NULL OR "instance_roles"."granted_by" <> "instance_roles"."principal_id"),
	CONSTRAINT "instance_role_granted_at" CHECK("instance_roles"."granted_at" IS NULL OR (typeof("instance_roles"."granted_at") = 'integer' AND "instance_roles"."granted_at" BETWEEN 0 AND 8640000000000000))
);
--> statement-breakpoint
CREATE TRIGGER instance_role_staff_only BEFORE INSERT ON instance_roles WHEN NOT EXISTS (SELECT 1 FROM principals p WHERE p.id = NEW.principal_id AND p.kind = 'staff') BEGIN SELECT RAISE(ABORT, 'Instance roles require a Staff principal'); END;
--> statement-breakpoint
CREATE TRIGGER instance_role_no_update BEFORE UPDATE ON instance_roles BEGIN SELECT RAISE(ABORT, 'Instance roles are immutable; revoke and grant instead'); END;
--> statement-breakpoint
-- Deployment-scoped administration is no longer borrowed from project
-- administration. Exactly one existing installation can only be identified
-- deterministically, so the earliest active Staff principal becomes the
-- first instance administrator and is recorded as the enablement event.
INSERT INTO instance_roles (principal_id, role, granted_at, granted_by)
SELECT p.id, 'instance-administrator', p.created_at, NULL
FROM principals p
WHERE p.kind = 'staff' AND p.status = 'active'
  AND NOT EXISTS (SELECT 1 FROM instance_roles r)
ORDER BY p.created_at, p.id
LIMIT 1;
--> statement-breakpoint
INSERT INTO audit_events (id, project_id, actor_id, system_actor, action, target_id, result, request_id, metadata, created_at)
SELECT 'b0000000-0000-4000-8000-000000000001', NULL, NULL, 'core.deployment', 'instance-role.backfilled', r.principal_id, 'success', 'b0000000-0000-4000-8000-000000000002', json_object('v', 1, 'role', 'instance-administrator'), r.granted_at
FROM instance_roles r
WHERE r.role = 'instance-administrator' AND r.granted_by IS NULL
  AND NOT EXISTS (SELECT 1 FROM audit_events e WHERE e.id = 'b0000000-0000-4000-8000-000000000001');
