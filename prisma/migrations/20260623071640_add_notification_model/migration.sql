-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('APPOINTMENT_BOOKED', 'APPOINTMENT_CANCELLED', 'APPOINTMENT_RESCHEDULED', 'APPOINTMENT_REMINDER', 'FOLLOW_UP_REMINDER');

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
