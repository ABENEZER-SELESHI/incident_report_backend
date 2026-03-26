//to start database display = pgadmin4
//to open database = psql -U incident_user -d incident_db -h localhost
//to clear tables = TRUNCATE TABLE otp_codes, users RESTART IDENTITY CASCADE;

//join as a superuser ==> 1, sudo -u postgres psql
2, \c incident_db

FINISHED FUNCTIONALITIES

1, ------------- AUTHENTICATION --------------
I ====== [signup(citizen, admin, employee), verify, login] ===== tested
II ===== [reset_password ] =========== untested

---

2, --------------- REPORTING -----------------
I ====== [post_issue, get_my_issues, vote_on_issues, search_issues, assign_issues, get_technicians, adjust_issue_status, get_pending_issues ] ====== tested
II ===== [dashboard, geospatial location] === untested
III ==== [] ================ unfinished

3,

ADMIN USER
password = Admin123
INSERT INTO users (
id,
phone,
email,
password_hash,
full_name,
role,
admin_unit_id,
is_verified,
is_active
)
VALUES (
'ed4a278a-4337-4846-a733-d3b9ea5fd366',
'+251911111111',
'admin@test.com',
'$2b$10$Vc.kEOFau3tCkA5Anj2NOeFTHoj0/qsbL3v94QwaPf15sCUW6riFO',
'System Admin',
'federal_admin',
NULL,
TRUE,
TRUE
);
