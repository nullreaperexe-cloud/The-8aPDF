// Generates isolated authentication fixtures for a controlled live integration
// run. The SQL is applied only by the database owner, and cleanup is mandatory.
// No real user's password or account is read or changed.
import {randomUUID,randomBytes} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
mkdirSync('.admin-test',{recursive:true});
const suffix=randomBytes(5).toString('hex');
const users=['super_admin','ordinary'].map(role=>({id:randomUUID(),email:`8apdf-integration-${role}-${suffix}@example.invalid`,password:randomBytes(30).toString('base64url'),role}));
const sql=users.map(u=>`
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change,email_change_token_new)
values('00000000-0000-0000-0000-000000000000','${u.id}','authenticated','authenticated','${u.email}',extensions.crypt('${u.password}',extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','');
insert into auth.identities(provider_id,user_id,identity_data,provider,created_at,updated_at)
values('${u.id}','${u.id}','${JSON.stringify({sub:u.id,email:u.email,email_verified:true})}','email',now(),now());
${u.role==='super_admin'?`insert into public.admin_users(user_id,role) values('${u.id}','super_admin');`:''}
`).join('\n');
writeFileSync('.admin-test/credentials.json',JSON.stringify({users,suffix},null,2));
writeFileSync('.admin-test/fixture.sql','begin;\n'+sql+'\ncommit;');
console.log('Generated two isolated test identities. Credentials are local and git-ignored.');
