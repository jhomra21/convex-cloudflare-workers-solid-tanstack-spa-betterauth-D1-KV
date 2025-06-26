create table "note" (
  "id" text not null primary key,
  "userId" text not null references "user" ("id"), 
  "title" text not null,
  "content" text,
  "status" text not null default 'active',
  "createdAt" date not null,
  "updatedAt" date not null
);

create index "note_userId_idx" on "note" ("userId"); 