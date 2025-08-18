-- Create feedback table
CREATE TABLE "feedback" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT REFERENCES "user" ("id"),
  "type" TEXT NOT NULL CHECK (type IN ('bug', 'feedback')),
  "message" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  "createdAt" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create index for efficient queries
CREATE INDEX "feedback_userId_idx" ON "feedback" ("userId");
CREATE INDEX "feedback_type_idx" ON "feedback" ("type");
CREATE INDEX "feedback_status_idx" ON "feedback" ("status");
CREATE INDEX "feedback_createdAt_idx" ON "feedback" ("createdAt");