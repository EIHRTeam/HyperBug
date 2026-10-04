CREATE TABLE "instance_roles" (
	"principal_id" uuid PRIMARY KEY NOT NULL,
	"role" text DEFAULT 'instance-administrator' NOT NULL,
	"granted_at" bigint NOT NULL,
	"granted_by" uuid,
	CONSTRAINT "instance_roles_principal_id_principals_id_fk" FOREIGN KEY ("principal_id") REFERENCES "public"."principals"("id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "instance_roles_granted_by_principals_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."principals"("id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "instance_role_value" CHECK ("instance_roles"."role" = 'instance-administrator'),
	CONSTRAINT "instance_role_no_self_grant" CHECK ("instance_roles"."granted_by" IS NULL OR "instance_roles"."granted_by" <> "instance_roles"."principal_id"),
	CONSTRAINT "instance_role_granted_at" CHECK ("instance_roles"."granted_at" BETWEEN 0 AND 8640000000000000)
);--> statement-breakpoint
CREATE OR REPLACE FUNCTION instance_role_staff_only() RETURNS trigger AS $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM principals p WHERE p.id = NEW.principal_id AND p.kind = 'staff') THEN
		RAISE EXCEPTION 'Instance roles require a Staff principal';
	END IF;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER instance_role_staff_only BEFORE INSERT ON instance_roles FOR EACH ROW EXECUTE FUNCTION instance_role_staff_only();--> statement-breakpoint
CREATE OR REPLACE FUNCTION instance_role_immutable() RETURNS trigger AS $$
BEGIN
	RAISE EXCEPTION 'Instance roles are immutable; revoke and grant instead';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER instance_role_no_update BEFORE UPDATE ON instance_roles FOR EACH ROW EXECUTE FUNCTION instance_role_immutable();--> statement-breakpoint
INSERT INTO instance_roles (principal_id, role, granted_at, granted_by)
SELECT p.id, 'instance-administrator', p.created_at, NULL
FROM principals p
WHERE p.kind = 'staff' AND p.status = 'active'
  AND NOT EXISTS (SELECT 1 FROM instance_roles r)
ORDER BY p.created_at, p.id
LIMIT 1;--> statement-breakpoint
INSERT INTO audit_events (id, project_id, actor_id, system_actor, action, target_id, result, request_id, metadata, created_at)
SELECT 'b0000000-0000-4000-8000-000000000001', NULL, NULL, 'core.deployment', 'instance-role.backfilled', r.principal_id, 'success', 'b0000000-0000-4000-8000-000000000002', '{"v":1,"role":"instance-administrator"}'::jsonb, r.granted_at
FROM instance_roles r
WHERE r.role = 'instance-administrator' AND r.granted_by IS NULL
  AND NOT EXISTS (SELECT 1 FROM audit_events e WHERE e.id = 'b0000000-0000-4000-8000-000000000001');
