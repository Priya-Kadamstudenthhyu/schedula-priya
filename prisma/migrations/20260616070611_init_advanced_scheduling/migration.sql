-- CreateEnum
CREATE TYPE "SchedulingType" AS ENUM ('STREAM', 'WAVE');

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "tokenNumber" INTEGER;

-- AlterTable
ALTER TABLE "DoctorProfile" ADD COLUMN     "bufferTime" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "schedulingType" "SchedulingType" NOT NULL DEFAULT 'STREAM',
ADD COLUMN     "waveCapacity" INTEGER NOT NULL DEFAULT 5;
