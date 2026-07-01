-- AlterTable
ALTER TABLE "DoctorProfile" ADD COLUMN     "allowFutureBooking" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "maxFutureBookingDays" INTEGER;
