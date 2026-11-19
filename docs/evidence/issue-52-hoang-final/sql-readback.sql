-- Read-only evidence for this task's isolated database and program, never for production.
-- The runtime checker also asserts these results through JDBC strict TLS.
USE [racehorse_local_hoang_issue52_20261119];
SET NOCOUNT ON;
SELECT p.id,p.name,p.status,p.template_version_id,v.version_no AS source_version,
       (SELECT MAX(latest.version_no) FROM dbo.template_version latest
        WHERE latest.training_program_template_id=t.id) AS latest_version,
       h.horse_code,h.lifecycle,ta.trainer_user_id,phase.objective,phase.is_customized
FROM dbo.horse_training_program p
JOIN dbo.template_version v ON v.id=p.template_version_id
JOIN dbo.training_program_template t ON t.id=v.training_program_template_id
JOIN dbo.horse h ON h.id=p.horse_id
JOIN dbo.trainer_assignment ta ON ta.horse_training_program_id=p.id
JOIN dbo.horse_program_phase phase ON phase.horse_training_program_id=p.id
WHERE p.id=1 AND p.name='QA-HOANG52-111932 Program' AND ta.effective_to IS NULL;

SELECT id,status,decision_reason,reviewed_by_user_id
FROM dbo.program_adjustment_request WHERE horse_training_program_id=1 ORDER BY id;

SELECT COUNT(*) AS apply_audit_count FROM dbo.audit_log
WHERE target_type='TRAINING_PROGRAM' AND target_id=1
  AND safe_summary LIKE '%Applied approved request %';

SELECT COUNT(*) AS persisted_profile_count FROM dbo.app_user
WHERE full_name='Hoang Issue52 Head Trainer' AND account_status='ACTIVE';

SELECT COUNT(*) AS trainer_notifications,
       COALESCE(SUM(CASE WHEN read_at IS NULL THEN 1 ELSE 0 END),0) AS unread
FROM dbo.notification WHERE recipient_user_id IN
  (SELECT trainer_user_id FROM dbo.trainer_assignment WHERE horse_training_program_id=1);
